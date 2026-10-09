/**
 * @file    src/components/panels/VaultControlPanel.tsx
 * @version 1.0.0
 * @description
 *   Web Crypto API (SubtleCrypto AES-256-GCM) Local Cryptographic Vault Control Panel.
 *   Conforms to PRD-017 Section 3.2:
 *   - Status visualization: Unconfigured / Locked / Unlocked.
 *   - Master Passphrase setup, unlocking, locking, and updating.
 *   - Zero plaintext persistence guarantee with OWASP 600,000 PBKDF2 iterations.
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/settings-store.ts';

export const VaultControlPanel: React.FC = () => {
  const language = useSettingsStore((s) => s.language);
  const vaultStatus = useSettingsStore((s) => s.vaultStatus);
  const vaultError = useSettingsStore((s) => s.vaultError);
  const hasLegacyKeysPending = useSettingsStore((s) => s.hasLegacyKeysPending);
  const setupMasterPassphrase = useSettingsStore((s) => s.setupMasterPassphrase);
  const unlockVault = useSettingsStore((s) => s.unlockVault);
  const lockVault = useSettingsStore((s) => s.lockVault);
  const changeMasterPassphrase = useSettingsStore((s) => s.changeMasterPassphrase);

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [oldPassphrase, setOldPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isChangingPassphrase, setIsChangingPassphrase] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isZh = language === 'zh';

  const clearInputs = () => {
    setPassphrase('');
    setConfirmPassphrase('');
    setOldPassphrase('');
    setLocalError(null);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessToast(null);

    if (passphrase.length < 6) {
      setLocalError(isZh ? '主口令长度至少需 6 位字符' : 'Passphrase must be at least 6 characters');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setLocalError(isZh ? '两次输入的口令不一致' : 'Passphrases do not match');
      return;
    }

    setIsSubmitting(true);
    const res = await setupMasterPassphrase(passphrase);
    setIsSubmitting(false);

    if (res.success) {
      clearInputs();
      setSuccessToast(
        isZh
          ? '主口令已设置，API Key 已加密存入 Web Crypto 本地暗室！'
          : 'Master passphrase configured. Secrets encrypted into Web Crypto Vault!',
      );
      setTimeout(() => setSuccessToast(null), 4000);
    } else {
      setLocalError(res.error || (isZh ? '设置失败' : 'Setup failed'));
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessToast(null);

    if (!passphrase.trim()) {
      setLocalError(isZh ? '请输入主口令' : 'Please enter master passphrase');
      return;
    }

    setIsSubmitting(true);
    const res = await unlockVault(passphrase);
    setIsSubmitting(false);

    if (res.success) {
      clearInputs();
      setSuccessToast(isZh ? '暗室已解锁，API Key 准备就绪' : 'Vault unlocked successfully');
      setTimeout(() => setSuccessToast(null), 4000);
    } else {
      setLocalError(res.error || (isZh ? '口令错误，解锁失败' : 'Unlock failed: incorrect passphrase'));
    }
  };

  const handleChangePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessToast(null);

    if (!oldPassphrase.trim()) {
      setLocalError(isZh ? '请输入当前主口令' : 'Please enter current passphrase');
      return;
    }
    if (passphrase.length < 6) {
      setLocalError(isZh ? '新主口令长度至少需 6 位字符' : 'New passphrase must be at least 6 characters');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setLocalError(isZh ? '新口令确认不一致' : 'New passphrases do not match');
      return;
    }

    setIsSubmitting(true);
    const res = await changeMasterPassphrase(oldPassphrase, passphrase);
    setIsSubmitting(false);

    if (res.success) {
      clearInputs();
      setIsChangingPassphrase(false);
      setSuccessToast(isZh ? '主口令已修改并重新加密暗室！' : 'Passphrase updated & re-encrypted successfully');
      setTimeout(() => setSuccessToast(null), 4000);
    } else {
      setLocalError(res.error || (isZh ? '修改失败' : 'Change failed'));
    }
  };

  return (
    <div id="patchcat-vault-control-panel" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              vaultStatus === 'unlocked'
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300/40'
                : vaultStatus === 'locked'
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300/40'
                  : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-300/40'
            }`}
          >
            {vaultStatus === 'unlocked' ? (
              <Unlock className="w-5 h-5" />
            ) : vaultStatus === 'locked' ? (
              <Lock className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {isZh ? 'Web Crypto 本地加密暗室' : 'Web Crypto Local Vault'}
              </h4>
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                  vaultStatus === 'unlocked'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : vaultStatus === 'locked'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {vaultStatus === 'unlocked'
                  ? isZh
                    ? '● 已解锁 (AES-256-GCM)'
                    : '● Unlocked (AES-256-GCM)'
                  : vaultStatus === 'locked'
                    ? isZh
                      ? '● 已锁定 (密文隔离)'
                      : '● Locked (Isolated)'
                    : isZh
                      ? '○ 未初始化'
                      : '○ Unconfigured'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isZh
                ? '端侧数据主权防护 · PBKDF2 600,000 轮派生 · LocalStorage/IndexedDB 绝无明文 API Key'
                : 'Local Data Sovereignty · PBKDF2 600k HMAC-SHA256 · Zero Plaintext Persistence'}
            </p>
          </div>
        </div>

        {/* Quick Actions when Unlocked */}
        {vaultStatus === 'unlocked' && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setIsChangingPassphrase((v) => !v);
                setLocalError(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              {isChangingPassphrase
                ? isZh
                  ? '取消修改'
                  : 'Cancel'
                : isZh
                  ? '修改主口令'
                  : 'Change Passphrase'}
            </button>
            <button
              type="button"
              onClick={lockVault}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-300/50 dark:border-amber-800 flex items-center gap-1.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isZh ? '立即锁定暗室' : 'Lock Vault'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-5 space-y-4">
        {/* Legacy Keys Migration Alert */}
        {hasLegacyKeysPending && vaultStatus === 'unconfigured' && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>{isZh ? '检测到旧版明文 API Key' : 'Legacy Plaintext Keys Detected'}:</strong>{' '}
              {isZh
                ? '系统已自动从 LocalStorage 中彻底擦除所有明文 Key 并置入内存。请立即设置本地主口令，将凭证经 AES-256-GCM 加密落盘至本地安全暗室，防止页面刷新后丢失。'
                : 'Plaintext keys have been purged from LocalStorage into memory session. Set your master passphrase to securely encrypt and persist them to the vault.'}
            </div>
          </div>
        )}

        {/* Feedback / Error Banners */}
        {localError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{localError}</span>
          </div>
        )}
        {successToast && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}
        {vaultError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {vaultError}
          </div>
        )}

        {/* Case 1: Unconfigured (Setup Master Passphrase) */}
        {vaultStatus === 'unconfigured' && (
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isZh
                ? '为了防御第三方浏览器恶意扩展抓取及 DOM/Storage 嗅探，所有大模型 Provider 的 API Key 均采用 AES-256-GCM 本地加密保存。设置主口令后，凭证将在本地加密持久化，LocalStorage 永不存有明文。'
                : 'To defend against browser extension sniffing and XSS credential harvesting, provider API keys are encrypted with AES-256-GCM. Set a master passphrase to enable cryptographic storage.'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {isZh ? '设置主口令 (Master Passphrase)' : 'Master Passphrase'}
                </label>
                <div className="relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={isZh ? '至少 6 位字符' : 'At least 6 characters'}
                    className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {isZh ? '确认主口令' : 'Confirm Passphrase'}
                </label>
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder={isZh ? '再次输入主口令' : 'Re-enter passphrase'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || passphrase.length < 6}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? isZh
                    ? '正在派生加密主密钥...'
                    : 'Deriving master key...'
                  : isZh
                    ? '启用 Web Crypto 加密暗室'
                    : 'Enable Secure Vault'}
              </span>
            </button>
          </form>
        )}

        {/* Case 2: Locked (Unlock Vault) */}
        {vaultStatus === 'locked' && (
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isZh
                ? '本地暗室目前处于锁定隔离状态。请输入主口令解锁，解密凭证以使用大模型推理或配置 API Key：'
                : 'The vault is locked. Enter your master passphrase to unlock and decrypt credentials for LLM execution.'}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1">
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder={isZh ? '输入本地主口令' : 'Enter master passphrase'}
                  className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !passphrase.trim()}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>
                  {isSubmitting
                    ? isZh
                      ? '验证解密中...'
                      : 'Decrypting...'
                    : isZh
                      ? '解锁暗室'
                      : 'Unlock Vault'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* Case 3: Unlocked (Status & Change Passphrase Sub-form) */}
        {vaultStatus === 'unlocked' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {isZh
                  ? '暗室已解锁。当前会话支持无感发起大模型调用，API Key 仅停留内存，关闭页面即刻销毁。'
                  : 'Vault unlocked. API Keys accessible in memory for active LLM calls; automatically evicted on unload.'}
              </span>
            </div>

            {/* Change Passphrase Sub-form */}
            {isChangingPassphrase && (
              <form
                onSubmit={handleChangePassphrase}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150"
              >
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  {isZh ? '修改主口令 (Re-encrypt Vault)' : 'Change Master Passphrase'}
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="password"
                    value={oldPassphrase}
                    onChange={(e) => setOldPassphrase(e.target.value)}
                    placeholder={isZh ? '原主口令' : 'Current passphrase'}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={isZh ? '新主口令 (>=6位)' : 'New passphrase'}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="password"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder={isZh ? '确认新口令' : 'Confirm new passphrase'}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsChangingPassphrase(false)}
                    className="px-3 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {isZh ? '取消' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || passphrase.length < 6}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? (isZh ? '处理中...' : 'Saving...') : isZh ? '确认修改' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
