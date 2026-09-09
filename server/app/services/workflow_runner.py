"""
Server-Side Workflow DAG Runner for REST API and SSE Execution
"""

import time
import json
import re
from typing import Any, Dict, List, Optional, AsyncGenerator, Tuple


def evaluate_condition_rule(operator: str, actual_val: Any, target_val: Any) -> bool:
    str_actual = "" if actual_val is None else str(actual_val).strip()
    str_target = "" if target_val is None else str(target_val).strip()

    try:
        num_actual = float(str_actual)
        num_target = float(str_target)
    except (ValueError, TypeError):
        num_actual = None
        num_target = None

    if operator == "equals":
        return str_actual.lower() == str_target.lower()
    elif operator == "not_equals":
        return str_actual.lower() != str_target.lower()
    elif operator == "contains":
        return str_target.lower() in str_actual.lower()
    elif operator == "not_contains":
        return str_target.lower() not in str_actual.lower()
    elif operator == "greater_than":
        return num_actual is not None and num_target is not None and num_actual > num_target
    elif operator == "less_than":
        return num_actual is not None and num_target is not None and num_actual < num_target
    elif operator == "is_empty":
        return actual_val is None or str_actual == ""
    elif operator == "is_not_empty":
        return actual_val is not None and str_actual != ""
    elif operator == "regex_match":
        try:
            return bool(re.search(str_target, str_actual, re.IGNORECASE))
        except Exception:
            return False
    return False


def resolve_variables(val: Any, context: Dict[str, Any]) -> Any:
    if isinstance(val, str):
        # Match {{nodeId.field}}
        pattern = r"\{\{\s*([a-zA-Z0-9_\-]+)\.([a-zA-Z0-9_\-]+)\s*\}\}"
        matches = list(re.finditer(pattern, val))
        if len(matches) == 1 and matches[0].group(0) == val:
            node_id = matches[0].group(1)
            field = matches[0].group(2)
            src = context.get(node_id, {})
            return src.get(field, "")

        def replacer(m):
            n_id = m.group(1)
            f_name = m.group(2)
            src = context.get(n_id, {})
            v = src.get(f_name, "")
            return str(v)

        return re.sub(pattern, replacer, val)
    elif isinstance(val, dict):
        return {k: resolve_variables(v, context) for k, v in val.items()}
    elif isinstance(val, list):
        return [resolve_variables(x, context) for x in val]
    return val


def topological_sort(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[List[str]]:
    node_ids = {n.get("id") for n in nodes if n.get("id")}
    in_degree = {nid: 0 for nid in node_ids}
    adj = {nid: [] for nid in node_ids}

    for edge in edges:
        src = edge.get("source")
        tgt = edge.get("target")
        if src in node_ids and tgt in node_ids:
            adj[src].append(tgt)
            in_degree[tgt] += 1

    current = [nid for nid, deg in in_degree.items() if deg == 0]
    layers = []

    while current:
        layers.append(list(current))
        next_layer = []
        for u in current:
            for v in adj.get(u, []):
                in_degree[v] -= 1
                if in_degree[v] == 0:
                    next_layer.append(v)
        current = next_layer

    return layers


async def run_workflow(
    workflow_data: Dict[str, Any],
    input_params: Dict[str, Any],
) -> Tuple[Dict[str, Any], Dict[str, int], int]:
    """
    Executes a workflow DAG synchronously on the server.
    Returns (outputs, token_usage, duration_ms)
    """
    start_time = time.time()
    nodes = workflow_data.get("nodes", [])
    edges = workflow_data.get("edges", [])

    node_map = {n.get("id"): n for n in nodes if n.get("id")}
    layers = topological_sort(nodes, edges)

    incoming_edges_map: Dict[str, List[Dict[str, Any]]] = {n.get("id"): [] for n in nodes}
    for edge in edges:
        tgt = edge.get("target")
        if tgt in incoming_edges_map:
            incoming_edges_map[tgt].append(edge)

    context: Dict[str, Any] = {}
    if input_params:
        context["global_input"] = input_params

    skipped_nodes = set()
    node_active_branch: Dict[str, str] = {}

    total_tokens = {"prompt": 0, "completion": 0, "total": 0}

    for layer in layers:
        for node_id in layer:
            node = node_map.get(node_id)
            if not node:
                continue

            node_data = node.get("data", {})
            node_type = node_data.get("type") or node.get("type", "unknown")
            config = node_data.get("config", {})
            raw_inputs = node_data.get("inputs", {})

            # Check if skipped
            incoming = incoming_edges_map.get(node_id, [])
            should_skip = node_id in skipped_nodes

            if not should_skip and incoming:
                if node_type == "aggregator":
                    has_active = False
                    for e in incoming:
                        src = e.get("source")
                        if src in skipped_nodes:
                            continue
                        src_node = node_map.get(src, {})
                        src_type = src_node.get("data", {}).get("type") or src_node.get("type")
                        if src_type == "condition":
                            active_branch = node_active_branch.get(src)
                            if active_branch and e.get("sourceHandle") and e.get("sourceHandle") != active_branch:
                                continue
                        has_active = True
                        break
                    if not has_active:
                        should_skip = True
                else:
                    for e in incoming:
                        src = e.get("source")
                        if src in skipped_nodes:
                            should_skip = True
                            break
                        src_node = node_map.get(src, {})
                        src_type = src_node.get("data", {}).get("type") or src_node.get("type")
                        if src_type == "condition":
                            active_branch = node_active_branch.get(src)
                            if active_branch and e.get("sourceHandle") and e.get("sourceHandle") != active_branch:
                                should_skip = True
                                break

            if should_skip:
                skipped_nodes.add(node_id)
                continue

            # Resolve inputs
            resolved = resolve_variables(raw_inputs, context)

            # Node-type execution
            node_output: Dict[str, Any] = {}

            if node_type == "input":
                node_output = {**resolved, **input_params, "output": {**resolved, **input_params}}
            elif node_type == "prompt":
                template = resolved.get("template") or config.get("template") or str(resolved)
                resolved_text = resolve_variables(template, context)
                node_output = {"promptText": resolved_text, "output": resolved_text}
            elif node_type == "llm":
                prompt = resolved.get("prompt") or resolved.get("promptText") or str(resolved)
                simulated_response = f"Simulated Server Response for prompt: {str(prompt)[:60]}..."
                tok_in = len(str(prompt)) // 4
                tok_out = len(simulated_response) // 4
                total_tokens["prompt"] += tok_in
                total_tokens["completion"] += tok_out
                total_tokens["total"] += (tok_in + tok_out)
                node_output = {
                    "response": simulated_response,
                    "output": simulated_response,
                    "tokenUsage": {"prompt": tok_in, "completion": tok_out, "total": tok_in + tok_out},
                }
            elif node_type == "condition":
                conditions = config.get("conditions", [])
                default_branch = config.get("defaultBranch", "else")
                matched_branch = default_branch

                for rule in conditions:
                    var_name = rule.get("variable", "").strip()
                    val = None
                    if var_name.startswith("{{") and var_name.endswith("}}"):
                        val = resolve_variables(var_name, context)
                    else:
                        val = resolved.get(var_name) or context.get(var_name)

                    if evaluate_condition_rule(rule.get("operator", "equals"), val, rule.get("value")):
                        matched_branch = rule.get("targetHandle", "if_true")
                        break

                node_active_branch[node_id] = matched_branch
                node_output = {"activeBranch": matched_branch, "output": {"activeBranch": matched_branch}}
            elif node_type == "aggregator":
                mode = config.get("mode", "first_available")
                output_key = config.get("outputKey", "result")
                agg_val = None

                if mode == "first_available":
                    for e in incoming:
                        src = e.get("source")
                        if src not in skipped_nodes and src in context:
                            src_out = context[src]
                            agg_val = src_out.get("output", src_out.get("result", src_out))
                            break
                elif mode == "merge_all":
                    agg_val = {
                        e.get("source"): context.get(e.get("source"), {}).get("output", context.get(e.get("source")))
                        for e in incoming if e.get("source") not in skipped_nodes
                    }
                elif mode == "wait_all":
                    agg_val = {
                        e.get("source"): (None if e.get("source") in skipped_nodes else context.get(e.get("source"), {}).get("output"))
                        for e in incoming
                    }

                node_output = {output_key: agg_val, "result": agg_val, "output": agg_val}
            elif node_type == "http":
                node_output = {
                    "status": 200,
                    "statusText": "OK",
                    "data": {"success": True, "message": "HTTP executed on server"},
                    "output": {"success": True},
                }
            elif node_type == "output":
                node_output = {"finalResult": resolved, "output": resolved}
            else:
                node_output = {"output": resolved}

            context[node_id] = node_output

    duration_ms = int((time.time() - start_time) * 1000)
    return context, total_tokens, duration_ms
