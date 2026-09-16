(async () => {
    "use strict";
    const CONFIG = {
        NAME: "Orion",
        VERSION: "v4.11.2",
        THEME: "#5865F2",
        SUCCESS: "#3BA55C",
        WARN: "#faa61a",
        ERR: "#f04747",
        HIDE_ACTIVITY: false,
        MAX_LOG_ITEMS: 60
    };
    const SYS = Object.freeze({
        MAX_TIME: 25 * 60 * 1000,
        HEARTBEAT_GRACE: 90 * 1000,
        MAX_TASK_FAILURES: 5,
        MAX_RETRIES: 3,
        IS_DESKTOP: typeof window.DiscordNative !== 'undefined'
    });
    const RUNTIME = {
        running: true,
        cleanups: new Set(),
        autoEnroll: true,
        autoClaim: false,
        playSound: false,
        randomDelay: false
    };
    const Sound = {
        _ctx: null,
        play(type) {
            if (!RUNTIME.playSound) return;
            try {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                if (!this._ctx || this._ctx.state === 'closed') this._ctx = new Ctx();
                const ctx = this._ctx;
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.type = 'sine';
                const t0 = ctx.currentTime;
                if (type === 'done') {
                    o.frequency.setValueAtTime(523.25, t0);
                    o.frequency.setValueAtTime(659.25, t0 + 0.12);
                    o.frequency.setValueAtTime(783.99, t0 + 0.24);
                    g.gain.setValueAtTime(0.55, t0);
                    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
                    o.start(t0); o.stop(t0 + 0.6);
                } else {
                    o.frequency.value = 880;
                    g.gain.setValueAtTime(0.45, t0);
                    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
                    o.start(t0); o.stop(t0 + 0.2);
                }
            } catch (_) { }
        }
    };
    const Consent = {
        _granted: new Set(),
        TIMEOUT: 60000,
        SCOPES: ['identify', 'applications.commands', 'applications.entitlements'],
        ask(appId, appName) {
            if (this._granted.has(appId)) return Promise.resolve(true);
            return new Promise(resolve => {
                const ov = document.createElement('div');
                ov.id = 'orion-consent';
                ov.style.cssText = 'position:fixed;inset:0;z-index:1002;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);font-family:var(--font-primary);';
                ov.innerHTML = `<div style="width:420px;max-width:92vw;background:var(--background-base-low);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);box-shadow:var(--shadow-button-overlay);color:var(--text-default);overflow:hidden;">
                    <div style="padding:14px 16px;background:var(--background-mod-muted);border-bottom:1px solid var(--border-subtle);font-weight:700;color:var(--text-strong);">授权应用？</div>
                    <div style="padding:16px;font-size:13px;line-height:1.5;">
                        <div>要完成这个成就任务，Orion 需要用 OAuth 在你的 Discord 账号上授权这个应用：</div>
                        <div id="oc-app" style="font-weight:700;color:var(--text-strong);margin:6px 0;"></div>
                        <div style="color:var(--text-muted);">申请的权限范围：</div>
                        <ul id="oc-scopes" style="margin:4px 0 10px;padding-left:18px;color:var(--text-muted);"></ul>
                        <div style="color:var(--text-feedback-warning);">该应用的后端会收到真实的授权码。任务标记完成后 Orion 会立即撤销授权。Discord 对任务自动化的处罚可能影响整个账号。</div>
                        <label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:12px;color:var(--text-muted);">
                            <input type="checkbox" id="oc-remember" class="native-cb"> 本次会话中不再询问该应用</label>
                    </div>
                    <div style="display:flex;gap:10px;padding:12px 16px;border-top:1px solid var(--border-subtle);">
                        <button id="oc-no" class="quest-pick-btn deselect" style="flex:1;">取消</button>
                        <button id="oc-yes" class="quest-pick-btn start" style="flex:1;">授权</button>
                    </div></div>`;
                document.body.appendChild(ov);
                ov.querySelector('#oc-app').textContent = appName ? `${appName} (${appId})` : `应用 ${appId}`;
                const ul = ov.querySelector('#oc-scopes');
                this.SCOPES.forEach(s => { const li = document.createElement('li'); li.textContent = s; ul.appendChild(li); });
                let done = false;
                const finish = v => {
                    if (done) return; done = true;
                    clearTimeout(timer); document.removeEventListener('keydown', onKey);
                    if (v && ov.querySelector('#oc-remember').checked) this._granted.add(appId);
                    ov.remove(); resolve(v);
                };
                const onKey = e => { if (e.key === 'Escape') finish(false); };
                ov.querySelector('#oc-yes').addEventListener('click', () => finish(true));
                ov.querySelector('#oc-no').addEventListener('click', () => finish(false));
                ov.addEventListener('mousedown', e => { if (e.target === ov) finish(false); });
                document.addEventListener('keydown', onKey);
                const timer = setTimeout(() => finish(false), this.TIMEOUT);
            });
        }
    };
    const ICONS = Object.freeze({
        OPT: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 2.88 0c.46-.06.7-.54.64-.99-.18-1.16.19-2.2.98-2.53.8-.33 1.79.14 2.49 1.1.27.36.78.52 1.14.24.77-.59 1.45-1.27 2.04-2.04.28-.36.12-.87-.24-1.14-.96-.7-1.43-1.7-1.1-2.49.33-.8 1.37-1.16 2.53-.98.45.07.93-.18.99-.64a11.1 11.1 0 0 0 0-2.88c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/></svg>`,
        BOLT: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.29-.62L14.5 3h1l-1 7h3.5c.58 0 .57.32.29.62L11 21z"/></svg>`,
        VIDEO: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`,
        GAME: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
        STREAM: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`,
        ACTIVITY: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>`,
        CHECK: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
        CLOCK: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
        STOP: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`
    });
    const CONST = Object.freeze({
        ID: "1412491570820812933",
        EVT: Object.freeze({
            HEARTBEAT: "QUESTS_SEND_HEARTBEAT_SUCCESS",
            HEARTBEAT_FAIL: "QUESTS_SEND_HEARTBEAT_FAILURE",
            GAME: "RUNNING_GAMES_CHANGE",
            RPC: "LOCAL_ACTIVITY_UPDATE"
        })
    });
    if (window.orionLock) {
        const existingUI = document.getElementById('orion-ui');
        if (existingUI) existingUI.style.display = 'flex';
        return console.warn(`[${CONFIG.NAME}] 已在运行中。`);
    }
    window.orionLock = true;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => HTML_ENTITIES[c]);
    const notExpired = q => {
        try {
            const store = Mods.QuestStore;
            if (typeof store?.isQuestExpired === 'function') return store.isQuestExpired(q.id) !== true;
        } catch (_) {  }
        const e = new Date(q.config?.expiresAt ?? 0).getTime();
        return Number.isNaN(e) || e > Date.now();
    };
    const orbReward = config => {
        const rewards = config?.rewardsConfig?.rewards;
        if (!Array.isArray(rewards)) return null;
        const amount = v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
        let orbs = 0, premium = 0;
        for (const r of rewards) {
            const base = amount(r?.orbQuantity);
            if (!base) continue;
            orbs += base;
            premium += amount(r?.premiumOrbQuantity) || base;
        }
        return orbs > 0 ? { orbs, premium } : null;
    };
    const fmtOrbs = reward => {
        if (!reward) return '';
        return reward.premium > reward.orbs ? `${reward.orbs} 个宝珠（开通 Nitro 为 ${reward.premium} 个）` : `${reward.orbs} 个宝珠`;
    };
    const orbBalance = v => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
    const readOrbBalance = async () => {
        const store = Mods.OrbStore;
        const stored = orbBalance(store?.getCurrentBalance?.() ?? store?.balance);
        if (stored !== null) return stored;
        const account = Mods.UserStore?.getCurrentUser?.()?.id ?? null;
        if (!account) throw new Error('当前没有已登录的账号');
        const res = await Mods.API.get({ url: '/users/@me/virtual-currency/balance' });
        const after = Mods.UserStore?.getCurrentUser?.()?.id ?? null;
        if (after !== account) throw new Error('读取过程中账号发生了切换');
        return orbBalance(res?.body?.balance);
    };
    const sealedFor = questId => {
        try { return Mods.QuestStore?.getQuest?.(questId)?.trafficMetadataSealed ?? null; }
        catch (_) { return null; }
    };
    const CONSOLE_ONLY_KEYS = new Set(['PLAY_ON_XBOX', 'PLAY_ON_PLAYSTATION']);
    const taskKeys = (tasks) => (tasks instanceof Map ? [...tasks.keys()] : Object.keys(tasks ?? {}));
    const taskAt = (tasks, key) => (tasks instanceof Map ? tasks.get(key) : tasks?.[key]);
    const selectTaskConfig = (config) => {
        const current = config?.taskConfigV2;
        if (taskKeys(current?.tasks).length > 0) return current;
        const legacy = config?.taskConfig;
        if (taskKeys(legacy?.tasks).length > 0) return legacy;
        return current ?? legacy ?? null;
    };
    const UNAUTOMATABLE_KEYS = new Map([
        ['ACHIEVEMENT_IN_GAME', '这需要先把游戏绑定到你的账号，并在游戏内真正获得该成就，任何在 Discord 里运行的东西都做不到。']
    ]);
    const questBlocker = ({ name, hasTaskConfig, keys, typeData, isDesktop }) => {
        if (!hasTaskConfig) return `"${name}" 没有可用的任务配置，无从执行。`;
        if (!typeData) {
            if (!keys.length) return `"${name}" 没有列出任何任务，无从执行。`;
            if (keys.every(k => CONSOLE_ONLY_KEYS.has(k))) return `"${name}" 仅限主机平台（${keys.join(', ')}），任何桌面客户端都无法运行。`;
            const named = keys.find(k => UNAUTOMATABLE_KEYS.has(k));
            if (named) {
                return keys.length === 1
                    ? `"${name}" 只提供 ${named}。${UNAUTOMATABLE_KEYS.get(named)}`
                    : `"${name}" 提供 ${keys.join(', ')}，没有一项能在这里运行。已知的是 ${named}。${UNAUTOMATABLE_KEYS.get(named)}`;
            }
            return `"${name}" 使用了不受支持的任务类型（${keys.join(', ')}）。`;
        }
        const { type, target, appId } = typeData;
        if (!isDesktop && (type === 'GAME' || type === 'STREAM')) return `"${name}" 的 ${type} 任务需要桌面客户端。`;
        if (target <= 0) return `"${name}" 的目标值无效（${target}）。`;
        if ((type === 'GAME' || type === 'STREAM') && !appId) return `"${name}" 的配置中没有应用 ID，无法伪造游戏进程。`;
        return null;
    };
    const recordOutcome = (outcomes, id, outcome) => {
        if (outcomes.get(id) === 'completed') return;
        outcomes.set(id, outcome);
    };
    const summarizeRun = (outcomes) => {
        let finished = 0, blocked = 0, failed = 0;
        for (const outcome of outcomes.values()) {
            if (outcome === 'completed') finished++;
            else if (outcome === 'blocked') blocked++;
            else failed++;
        }
        if (!blocked && !failed) return { finished, blocked, failed, line: '所有可用的任务都已完成！', playDone: true };
        const parts = [];
        if (finished) parts.push(`已完成 ${finished} 个任务`);
        if (blocked) parts.push(`跳过 ${blocked} 个（本客户端无法执行）`);
        if (failed) parts.push(`失败 ${failed} 个`);
        return { finished, blocked, failed, line: `没有可执行的任务了。${parts.join('，')}。`, playDone: finished > 0 };
    };
    const futureDate = (raw) => {
        try {
            if (!raw) return null;
            const when = raw instanceof Date ? raw : new Date(raw);
            return Number.isNaN(when.getTime()) || when.getTime() <= Date.now() ? null : when;
        } catch (_) { return null; }
    };
    const enrollmentBlockedUntil = () => futureDate(Mods.QuestStore?.questEnrollmentBlockedUntil);
    const questAccessSuspendedUntil = () => {
        const store = Mods.QuestStore;
        if (!store) return null;
        const explicit = futureDate(store.questAccessSuspendedUntil);
        if (explicit) return explicit;
        return store.isQuestAccessSuspended === true ? new Date(0) : null;
    };
    const buildStreamKey = () => {
        try {
            const ownerId = Mods.UserStore?.getCurrentUser?.()?.id;
            if (!ownerId) return null;
            const dm = Mods.ChanStore?.getSortedPrivateChannels()?.[0]?.id;
            if (dm) return `call:${dm}:${ownerId}`;
            for (const g of Object.values(Mods.GuildChanStore?.getAllGuilds() ?? {})) {
                const vc = g?.VOCAL?.[0]?.channel;
                const guildId = vc?.guild_id ?? g?.id;
                if (vc?.id && guildId) return `guild:${guildId}:${vc.id}:${ownerId}`;
            }
            return null;
        } catch (e) {
            Logger.log(`[任务] 直播键查询出错：${e.message}`, 'debug');
            return null;
        }
    };
    const ErrorHandler = {
        RETRYABLE: new Set([429, 500, 502, 503, 504, 408]),
        CLIENT_ERRORS: new Set([400, 403, 404, 409, 410]),
        classify(error) {
            const status = error?.status ?? error?.statusCode;
            return {
                isRetryable: this.RETRYABLE.has(status),
                isClientError: this.CLIENT_ERRORS.has(status),
                status,
                message: error?.message ?? error?.body?.message ?? `HTTP ${status ?? '未知'}`
            };
        },
        isSkippableQuest(error) {
            const status = error?.status;
            return status === 404 || status === 403 || status === 410;
        }
    };
    const Logger = {
        root: null, tasks: new Map(), tickerId: null, _hotkey: null,
        init() {
            const oldUI = document.getElementById('orion-ui'); if (oldUI) oldUI.remove();
            const oldStyle = document.getElementById('orion-styles'); if (oldStyle) oldStyle.remove();
            const style = document.createElement('style');
            style.id = 'orion-styles';
            style.innerHTML = `
                @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes fadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); margin: 0; padding: 0; height: 0; border: none; } }
                #orion-ui {
                    position: fixed; top: 32px; left: auto; right: 20px; width: 380px;
                    max-height: 53vh;
                    background: var(--background-base-low); color: var(--text-default);
                    border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-button-overlay); z-index: 1001;
                    font-family: var(--font-primary);
                    overflow: hidden; animation: slideIn 0.3s ease;
                    display: flex; flex-direction: column; box-sizing: border-box;
                    user-select: none;-webkit-app-region: no-drag;
                }
                #orion-head { padding: 12px 16px; background: var(--background-mod-muted); flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); cursor: grab; }
                #orion-head.dragging { cursor: grabbing; background: var(--control-secondary-background-default); }
                #orion-title { font-weight: 700; font-size: 15px; color: var(--text-strong); display: flex; align-items: center; gap: 8px; }
                #orion-title svg { color: var(--text-brand); }
                .dev-credit { font-size: 12px; margin-left: -4px; padding-top: 2px; font-weight: 500; color: var(--text-muted); }
                #orion-controls { display: flex; gap: 10px; align-items: center; }
                .ctrl-btn { cursor: pointer; transition: 0.2s; display: flex; align-items: center; }
                .ctrl-hide, .ctrl-opts { font-size: 11px; font-weight: 600; color: var(--text-muted); }
                .ctrl-hide:hover, .ctrl-opts:hover { color: var(--text-default); }
                .ctrl-stop { font-size: 11px; font-weight: 700; gap: 4px; padding: 3px 8px 3px 6px; border-radius: var(--radius-sm); background: transparent; border: 1px solid var(--control-critical-primary-background-default); color: var(--control-critical-primary-background-default); }
                .ctrl-stop:hover { background: var(--control-critical-primary-background-default); color: #fff; }
                #orion-logs { padding: 10px 14px; background: var(--background-base-lower); flex: 0 0 auto; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; height: 110px; overflow-y: auto; border-top: 1px solid var(--border-subtle); scroll-behavior: smooth; }
                .log-item { margin-bottom: 6px; display: flex; gap: 8px; line-height: 1.4; padding-bottom: 4px; }
                .log-ts { opacity: 0.5; min-width: 50px; font-size: 10px; }
                .c-info { color: var(--text-feedback-info); opacity: .8; } .c-success { color: var(--text-feedback-positive); } .c-err { color: var(--text-feedback-critical); } .c-warn { color: var(--text-feedback-warning); } .c-debug { color: #949ba4; }
                #orion-body { flex: 1 1 auto; padding: 12px; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
                #orion-picker-form { display: flex; flex-direction: column; min-height: 0; }
                #orion-ui ::-webkit-scrollbar { width: 4px; height: 4px; }
                #orion-ui ::-webkit-scrollbar-track { background: transparent; }
                #orion-ui ::-webkit-scrollbar-thumb { background: var(--scrollbar-auto-scrollbar-color-thumb); border-radius: 4px; }
                .task-card {
                    --state-color: var(--ansi-bright-blue);
                    --icon-bg-opacity: 15%;
                    --icon-color: var(--state-color);
                    display: flex; gap: 12px; padding: 10px 12px; margin-bottom: 8px; align-items: center;
                    background: var(--control-secondary-background-default);
                    border-radius: var(--radius-sm); border: 1px solid var(--border-muted);
                    border-left: 4px solid var(--state-color);
                    box-shadow: var(--shadow-low); transition: 0.3s; flex-shrink: 0;
                }
                .task-card.removing { animation: fadeOut 0.4s forwards; }
                .task-card.done { --state-color: var(--ansi-green); --icon-bg-opacity: 100%; --icon-color: #fff; }
                .task-card.failed { --state-color: var(--ansi-red); }
                .task-card.pending { --state-color: var(--ansi-bright-yellow); }
                .task-icon { position: relative; width: 40px; height: 40px; border-radius: 50%; flex: 0 0 auto; background-color: color-mix(in srgb, var(--state-color) var(--icon-bg-opacity), transparent); display: flex; align-items: center; justify-content: center; }
                .task-card.running .task-icon::before { content: ''; position: absolute; inset: 0; border-radius: 50%; z-index: 1; background: conic-gradient(lch(71 59 139) 0% var(--p, 0%), var(--border-subtle) var(--p, 0%) 100%); -webkit-mask-image: radial-gradient(circle at center, transparent 16px, black 17px); mask-image: radial-gradient(circle at center, transparent 16px, black 17px); }
                .task-icon-inner { z-index: 2; color: var(--icon-color); display: flex; transition: filter 0.2s, opacity 0.2s; }
                .task-card.running:hover .task-icon-inner { filter: blur(2px); opacity: 0.3; }
                .task-icon-overlay { position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: var(--text-default); opacity: 0; transition: opacity 0.2s; pointer-events: none; }
                .task-card.running:hover .task-icon-overlay { opacity: 1; }
                .task-info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; justify-content: center; }
                .task-status { font-size: 10px; font-weight: 800; color: var(--state-color); text-transform: uppercase; letter-spacing: 0.5px; }
                .task-name { font-size: 13px; font-weight: 700; color: var(--text-strong); letter-spacing: 0.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
                .task-meta { font-size: 11px; font-weight: 700; color: var(--text-muted); display: flex; justify-content: space-between; }
                .task-actions { flex: 0 0 auto; display: flex; align-items: center; margin-left: 4px; }
                .claim-btn, .goto-btn { padding: 6px 10px; border: none; border-radius: var(--radius-sm); font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 0.2px; white-space: nowrap; font-family: inherit; color: #fff; }
                .claim-btn { background: var(--control-connected-background-default); }
                .claim-btn:hover:not(:disabled) { background: var(--control-connected-background-hover); }
                .claim-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .claim-btn.failed { background: var(--control-secondary-background-active); color: var(--text-default); }
                .goto-btn { background: var(--control-primary-background-default); }
                .goto-btn:hover:not(:disabled) { background: var(--control-primary-background-hover); }
                .picker-section-title { font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0; }
                .reward-filters { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; flex-shrink: 0; }
                .reward-filter, .type-filter { background-color: transparent; border: 2px solid; padding: 4px 10px; border-radius: 24px; font-size: 10px; font-weight: 600; cursor: pointer; transition: 0.2s; color: var(--text-subtle); font-family: inherit; }
                .reward-filter:hover, .type-filter:hover { background-color: color-mix(in srgb, currentColor 25%, transparent); }
                .reward-filter.off, .type-filter.off { background: transparent; color: var(--text-muted); opacity: 0.4; }
                .picker-quest-list { display: flex; flex-direction: column; gap: 8px; flex: 1 1 auto; min-height: 50px; overflow-y: auto; padding-right: 4px; }
                .quest-pick { display: flex; gap: 12px; padding: 10px; background: var(--control-secondary-background-default); border-radius: var(--radius-sm); border: 1px solid var(--border-muted); border-left-width: 4px; cursor: pointer; transition: 0.2s; align-items: center; user-select: none; flex-shrink: 0; }
                .quest-pick:hover { filter: brightness(1.15); }
                .quest-pick.hidden { display: none !important; }
                .native-cb { appearance: none; width: 20px; height: 20px; margin: 0; flex-shrink: 0; border: 1px solid var(--checkbox-border-default); border-radius: var(--radius-xs); background: transparent; cursor: pointer; transition: 0.15s; display: grid; place-content: center; }
                .native-cb::before {
                    content: ''; width: 12px; height: 12px; opacity: 0; transition: 0.1s;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E");
                    background-size: contain; background-repeat: no-repeat; background-position: center;
                }
                .native-cb:checked { background: var(--checkbox-background-selected-default); border-color: var(--checkbox-border-selected-default); }
                .native-cb:checked::before { opacity: 1; }
                .picker-options { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
                .orion-option { display: flex; justify-content: space-between; align-items: center; background: var(--control-secondary-background-default); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-muted); }
                .orion-option-label { font-size: 13px; font-weight: 500; color: var(--text-default); }
                .native-toggle { appearance: none; width: 40px; height: 20px; margin: 0; flex-shrink: 0; background: var(--control-secondary-background-default); border-radius: 12px; cursor: pointer; position: relative; transition: 0.2s; border: 1px solid var(--border-muted); }
                .native-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: white; border-radius: 50%; box-shadow: var(--shadow-low); transition: 0.2s; }
                .native-toggle:checked { background: var(--control-primary-background-default); }
                .native-toggle:checked::after { transform: translateX(20px); }
                .orb-total { display: none; padding-top: 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #5865F2; text-align: center; flex-shrink: 0; }
                .picker-actions { display: flex; gap: 10px; padding-top: 12px; flex-shrink: 0; }
                .quest-pick-btn { flex: 1; padding: 10px; border: 1px solid; border-radius: var(--radius-sm, 8px); font-size: 13px; font-weight: 700; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit; color: #fff;}
                .quest-pick-btn.start { background-color: var(--control-connected-background-default); border-color: var(--control-connected-border-default); }
                .quest-pick-btn.start:hover:not(:disabled) { background: var(--control-connected-background-hover); border-color: var(--control-connected-border-hover); }
                .quest-pick-btn.deselect { background-color: var(--control-secondary-background-default); border-color: var(--control-secondary-border-default); color: var(--text-default); }
                .quest-pick-btn.deselect:hover:not(:disabled) { background: var(--control-secondary-background-hover); }
                .quest-pick-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            `;
            document.head.appendChild(style);
            this.root = document.createElement('div');
            this.root.id = 'orion-ui';
            this.root.innerHTML = `
                <div id="orion-head">
                    <span id="orion-title">${ICONS.BOLT} ${CONFIG.NAME}
                        <span class="dev-credit">作者 syntt_</span>
                        <span style="opacity:0.6; font-size:10px; margin-left:4px; padding-top: 3px; font-weight:500;">${CONFIG.VERSION}</span>
                    </span>
                    <div id="orion-controls">
                        <span class="ctrl-btn ctrl-stop" id="orion-stop" title="停止脚本">${ICONS.STOP} 停止</span>
                        <span class="ctrl-btn ctrl-hide" id="orion-close" title="Shift + .">隐藏</span>
                        <span class="ctrl-btn ctrl-opts" id="orion-opts" title="选项">${ICONS.OPT}</span>
                    </div>
                </div>
                <div id="orion-body"><div style="text-align:center; padding:30px; color:var(--text-muted); font-size:12px; font-weight:500;">系统初始化中...</div></div>
                <div id="orion-logs"></div>
            `;
            document.body.appendChild(this.root);
            const head = document.getElementById('orion-head');
            let collapsed = false;
            head.addEventListener('dblclick', e => {
                if (e.target.closest('.ctrl-btn')) return;
                collapsed = !collapsed;
                this.root.style.height = collapsed ? '50px' : '';
            });
            head.addEventListener('mousedown', e => {
                if (e.target.closest('.ctrl-btn')) return;
                head.classList.add('dragging');
                const startX = e.clientX, startY = e.clientY;
                const rect = this.root.getBoundingClientRect();
                const initialLeft = rect.left, initialTop = rect.top;
                this.root.style.left = `${initialLeft}px`;
                this.root.style.top = `${initialTop}px`;
                this.root.style.right = 'auto';
                e.preventDefault();
                const onMouseMove = ev => {
                    this.root.style.left = `${Math.max(0, Math.min(initialLeft + (ev.clientX - startX), window.innerWidth - this.root.offsetWidth))}px`;
                    this.root.style.top = `${Math.max(0, Math.min(initialTop + (ev.clientY - startY), window.innerHeight - 50))}px`;
                };
                const onMouseUp = () => {
                    head.classList.remove('dragging');
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
            document.getElementById('orion-body').addEventListener('click', async (e) => {
                if (e.target.classList.contains('goto-btn')) {
                    if (Mods.Router) Mods.Router.transitionTo('/quest-home');
                    return;
                }
                if (e.target.classList.contains('claim-btn')) {
                    const btn = e.target;
                    if (btn.disabled) return;
                    const questId = btn.getAttribute('data-id');
                    const taskData = this.tasks.get(questId);
                    if (!taskData) return;
                    btn.innerText = "等待中...";
                    btn.disabled = true;
                    btn.style.opacity = "0.5";
                    this.updateTask(questId, { ...taskData, claimState: 'WAITING' });
                    try {
                        const claimRes = await Tasks.claimReward(questId);
                        if (claimRes?.body?.claimed_at) {
                            btn.innerText = "已领取！";
                            this.log(`[领取] "${taskData.name}" 的奖励领取成功！`, 'success');
                            this.updateTask(questId, { ...taskData, status: "CLAIMED", claimable: false, claimState: null });
                            setTimeout(() => this.removeTask(questId), 2000);
                        } else {
                            this.log(`[领取] "${taskData.name}" 的奖励未获确认，请到 Discord 的任务页面手动领取。`, 'warn');
                            this.updateTask(questId, { ...taskData, claimState: 'FAILED' });
                        }
                    } catch (err) {
                        this.log(`[领取] "${taskData.name}" 需要人工操作，请在 Discord 界面中查看是否有验证码。`, 'warn');
                        this.updateTask(questId, { ...taskData, claimState: 'FAILED' });
                    }
                }
            });
            document.getElementById('orion-close').onclick = () => this.toggle();
            document.getElementById('orion-stop').onclick = () => this.shutdown();
            this._hotkey = e => (e.key === '>' || (e.shiftKey && e.key === '.')) && this.toggle();
            document.addEventListener('keydown', this._hotkey);
            document.getElementById('orion-opts').addEventListener('click', () => {
                const panel = document.getElementById('orion-options-panel');
                if (!panel) return;
                const open = panel.style.display === 'none';
                panel.style.display = open ? '' : 'none';
                const list = document.getElementById('orion-quest-list');
                if (list) list.style.display = open ? 'none' : '';
                const actions = document.querySelector('#orion-picker-form .picker-actions');
                if (actions) actions.style.display = open ? 'none' : '';
            });
            this.startTicker();
        },
        toggle() {
            if (!this.root?.parentElement) return;
            this.root.style.display = this.root.style.display === 'none' ? 'flex' : 'none';
        },
        shutdown() {
            if (!RUNTIME.running) return;
            RUNTIME.running = false;
            this.log("[系统] 正在停止脚本并清理...", "warn");
            if (this.tickerId) clearInterval(this.tickerId);
            if (this._hotkey) { document.removeEventListener('keydown', this._hotkey); this._hotkey = null; }
            for (const cleanupFn of RUNTIME.cleanups) {
                try { cleanupFn(); } catch (e) { this.log(`[清理] ${e.message}`, 'debug'); }
            }
            RUNTIME.cleanups.clear();
            Patcher.clean();
            window.orionLock = false;
            const styles = document.getElementById('orion-styles');
            const root = this.root;
            setTimeout(() => {
                if (styles?.parentElement) styles.remove();
                if (root?.parentElement) root.remove();
            }, 1000);
        },
        _getPct(t) {
            if (t.done) return 100;
            if (t.pending || t.failed || !t.max) return 0;
            return Math.min(100, (t.cur / t.max) * 100);
        },
        SERVER_DRIVEN: ["GAME", "STREAM"],
        startTicker() {
            if (this.tickerId) clearInterval(this.tickerId);
            this.tickerId = setInterval(() => {
                if (!RUNTIME.running) return clearInterval(this.tickerId);
                for (const [id, task] of this.tasks.entries()) {
                    if (task.status !== "RUNNING" || task.type === "ACHIEVEMENT") continue;
                    let cur;
                    if (this.SERVER_DRIVEN.includes(task.type)) {
                        if (task.serverAt == null) continue;
                        cur = Math.min(task.serverCur + (Date.now() - task.serverAt) / 1000, task.max);
                    } else {
                        cur = Math.min(task.cur + 1, task.max);
                    }
                    this.updateTask(id, { cur });
                }
            }, 1000);
        },
        updateTask(id, data) {
            const oldData = this.tasks.get(id);
            const isPending = data.status === "PENDING" || data.status === "QUEUE";
            const isDone = data.status === "COMPLETED" || data.status === "CLAIMED";
            const isFailed = data.status === "FAILED";
            const newData = { ...oldData, ...data, done: isDone, pending: isPending, failed: isFailed };
            this.tasks.set(id, newData);
            if (oldData && oldData.status === newData.status && oldData.removing === newData.removing &&
                oldData.claimable === newData.claimable && oldData.claimState === newData.claimState &&
                oldData.actionRequired === newData.actionRequired) {
                const card = document.getElementById(`orion-task-${esc(id)}`);
                if (card) {
                    const pct = this._getPct(newData);
                    const iconContainer = card.querySelector('.task-icon');
                    if (iconContainer) iconContainer.style.setProperty('--p', `${pct}%`);
                    const overlay = card.querySelector('.task-icon-overlay');
                    if (overlay) overlay.textContent = `${Math.floor(pct)}%`;
                    const progressText = card.querySelector('.progress-text');
                    if (progressText) {
                        const unit = newData.type === 'ACHIEVEMENT' ? '' : 's';
                        progressText.textContent = `${Math.min(Math.floor(newData.cur), newData.max)} / ${newData.max}${unit}`;
                    }
                    return;
                }
            }
            this.render();
        },
        removeTask(id) {
            if (this.tasks.has(id)) {
                this.tasks.get(id).removing = true;
                this.render();
                setTimeout(() => { this.tasks.delete(id); this.render(); }, 500);
            }
        },
        log(msg, type = 'info') {
            const colors = { info: "#5865F2", success: "#3BA55C", warn: "#faa61a", err: "#f04747", debug: "#999" };
            console.log(`%c[ORION] %c${msg}`, `color: ${CONFIG.THEME}; font-weight: bold;`, `color: ${colors[type] || colors.info}`);
            try {
                const box = document.getElementById('orion-logs');
                if (box && type !== 'debug') {
                    const el = document.createElement('div'); el.className = `log-item c-${type}`;
                    el.innerHTML = `<span class="log-ts">${new Date().toLocaleTimeString().split(' ')[0]}</span> <span>${esc(msg)}</span>`;
                    box.appendChild(el); box.scrollTop = box.scrollHeight;
                    while (box.children.length > CONFIG.MAX_LOG_ITEMS) box.firstChild.remove();
                }
            } catch (e) { console.debug('[日志] DOM 错误：', e.message); }
        },
        render() {
            if (document.getElementById('orion-picker-form')) return;
            const body = document.getElementById('orion-body');
            if (!body) return;
            if (!this.tasks.size) return body.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">正在等待任务...</div>`;
            const sorted = [...this.tasks.entries()].sort((a, b) => {
                const ta = a[1], tb = b[1];
                if (ta.done !== tb.done) return ta.done ? 1 : -1;
                if (ta.failed !== tb.failed) return ta.failed ? 1 : -1;
                if (ta.pending !== tb.pending) return ta.pending ? 1 : -1;
                if (!ta.done && !ta.pending && !tb.done && !tb.pending) {
                    const pctA = ta.max ? ta.cur / ta.max : 0;
                    const pctB = tb.max ? tb.cur / tb.max : 0;
                    return pctB - pctA;
                }
                return 0;
            });
            body.innerHTML = sorted.map(([id, t]) => {
                const pct = t.pending || t.failed ? 0 : Math.min(100, (t.cur / t.max) * 100).toFixed(1);
                const icon =
                    t.done ? ICONS.CHECK :
                    t.failed ? ICONS.STOP :
                    t.pending ? ICONS.CLOCK :
                    t.type === 'VIDEO' ? ICONS.VIDEO :
                    t.type === 'ACHIEVEMENT' ? ICONS.ACTIVITY :
                    t.type?.includes('GAME') ? ICONS.GAME :
                    t.type?.includes('STREAM') ? ICONS.STREAM :
                    ICONS.BOLT;
                let statusText = t.status === 'CLAIMED' ? '已领取' : t.done ? '已完成' : t.status;
                let progressLabel = t.pending ? '排队中' : t.failed ? '已中止' : '进度';
                const unit = t.type === 'ACHIEVEMENT' ? '' : 's';
                let actionBtn = '';
                if (t.claimable) {
                    if (t.claimState === 'WAITING') actionBtn = `<button class="claim-btn" disabled>等待中...</button>`;
                    else if (t.claimState === 'FAILED') actionBtn = `<button class="claim-btn failed" disabled>需要人工操作</button>`;
                    else actionBtn = `<button class="claim-btn" data-id="${esc(id)}">领取奖励</button>`;
                } else if (t.actionRequired === 'ENROLL') {
                    statusText = '需要人工操作'; progressLabel = '请在 Discord 中接受任务';
                    actionBtn = `<button class="goto-btn">前往任务页面</button>`;
                } else if (t.type === 'ACHIEVEMENT' && t.status === 'RUNNING') {
                    statusText = '需要人工操作'; progressLabel = '请手动完成';
                    actionBtn = `<button class="goto-btn">前往任务页面</button>`;
                }
                const stateClass = t.done ? 'done' : t.failed ? 'failed' : t.pending ? 'pending' : 'running';
                const removingClass = t.removing ? 'removing' : '';
                let taskMetaHtml = '';
                if (!t.done) {
                    taskMetaHtml = `
                    <div class="task-meta">
                        <span>${progressLabel}</span>
                        ${actionBtn ? '' : `<span class="progress-text">${Math.min(Math.floor(t.cur), t.max)} / ${t.max}${unit}</span>`}
                    </div>`;
                }
                return `
                <div id="orion-task-${esc(id)}" class="task-card ${stateClass} ${removingClass}">
                    <div class="task-icon" style="--p: ${pct}%">
                        <div class="task-icon-inner">${icon}</div>
                        ${stateClass === 'running' ? `<div class="task-icon-overlay">${Math.floor(pct)}%</div>` : ''}
                    </div>
                    <div class="task-info">
                        <div class="task-status">${statusText}</div>
                        <div class="task-name" title="${esc(t.name)}">${esc(t.name)}</div>
                        ${taskMetaHtml}
                    </div>
                    ${actionBtn ? `<div class="task-actions">${actionBtn}</div>` : ''}
                </div>`;
            }).join('');
        },
        showQuestPicker(quests) {
            return new Promise((resolve) => {
                const body = document.getElementById('orion-body');
                const logs = document.getElementById('orion-logs');
                const closePicker = (data) => {
                    if (logs) logs.style.display = 'block';
                    if (body) { body.classList.remove('picker-mode'); body.innerHTML = ''; }
                    resolve(data);
                };
                if (!body) return closePicker({ selectedQuests: new Set(), autoEnroll: false, autoClaim: false, playSound: false });
                if (logs) logs.style.display = 'none';
                const items = [];
                const rewardTypes = new Map();
                const questTypes = new Set();
                const REWARD_META = { 1: { label: "游戏内物品", color: "#e67e22" }, 3: { label: "头像装饰", color: "#a358f2" }, 4: { label: "宝珠", color: "#5865F2" } };
                const REWARD_FALLBACK = { label: "其他", color: "#949ba4" };
                quests.forEach(q => {
                    const cfg = selectTaskConfig(q.config);
                    if (!cfg?.tasks) return;
                    const typeData = Tasks.detectType(cfg, q.config?.application?.id);
                    if (!typeData) return;
                    if (!SYS.IS_DESKTOP && (typeData.type === 'GAME' || typeData.type === 'STREAM')) return;
                    const rw = q.config?.rewardsConfig?.rewards?.[0];
                    const rewardType = rw?.type ?? 0;
                    const rewardText = rw?.messages?.name ?? "未知奖励";
                    const meta = REWARD_META[rewardType] ?? REWARD_FALLBACK;
                    const displayType = typeData.type === 'WATCH_VIDEO' ? 'VIDEO' : typeData.type;
                    questTypes.add(displayType);
                    if (!rewardTypes.has(rewardType)) {
                        rewardTypes.set(rewardType, { label: meta.label, count: 0, type: rewardType, color: meta.color });
                    }
                    rewardTypes.get(rewardType).count++;
                    const orbs = orbReward(q.config);
                    items.push({
                        id: q.id,
                        name: q.config?.messages?.questName ?? "未知任务",
                        type: displayType,
                        rewardType,
                        rewardText,
                        orbs: orbs?.orbs ?? 0,
                        premiumOrbs: orbs?.premium ?? 0,
                        orbText: fmtOrbs(orbs),
                        color: meta.color
                    });
                });
                if (!items.length) return closePicker({ selectedQuests: new Set(), autoEnroll: false, autoClaim: false, playSound: false });
                const buildCard = (q) => `
                    <label class="quest-pick" data-rt="${q.rewardType}" data-qt="${q.type}" data-orbs="${q.orbs}" data-premium-orbs="${q.premiumOrbs}" style="border-left-color: ${q.color};">
                        <input type="checkbox" name="quests" value="${q.id}" class="native-cb" checked>
                        <div class="task-info">
                            <div class="task-name" title="${esc(q.name)}">${esc(q.name)}</div>
                            <div class="task-meta" style="justify-content: flex-start; gap: 8px;">
                                <span style="text-transform: uppercase; color: var(--text-subtle);">${esc(q.type)}</span>
                                <span style="color: ${q.color};">${esc(q.orbText || q.rewardText)}</span>
                            </div>
                        </div>
                    </label>`;
                const buildToggle = (name, label, isChecked) => `
                    <div class="orion-option">
                        <span class="orion-option-label">${label}</span>
                        <input type="checkbox" name="${name}" class="native-toggle" ${isChecked ? 'checked' : ''}>
                    </div>`;
                body.innerHTML = `
                    <form id="orion-picker-form">
                        <div id="orion-options-panel" style="display:none;">
                            ${rewardTypes.size > 1 ? `
                                <div class="picker-section-title">按奖励筛选</div>
                                <div class="reward-filters">
                                    ${[...rewardTypes.values()].map(rt => `<button type="button" class="reward-filter" data-rt="${rt.type}" style="color: ${rt.color}; border-color: ${rt.color};">${rt.label} (${rt.count})</button>`).join('')}
                                </div>
                            ` : ''}
                            ${questTypes.size > 1 ? `
                                <div class="picker-section-title">按类型筛选</div>
                                <div class="reward-filters">
                                    ${[...questTypes].map(t => `<button type="button" class="type-filter" data-qt="${t}">${t}</button>`).join('')}
                                </div>
                            ` : ''}
                            <div class="picker-section-title">选项</div>
                            <div class="picker-options">
                                ${buildToggle('autoEnroll', '自动接受任务', RUNTIME.autoEnroll)}
                                ${buildToggle('autoClaim', '自动领取奖励', RUNTIME.autoClaim)}
                                ${buildToggle('playSound', '完成时播放提示音', RUNTIME.playSound)}
                                ${buildToggle('randomDelay', '每轮之间随机延迟 1-30 分钟', RUNTIME.randomDelay)}
                            </div>
                        </div>
                        <div id="orion-quest-list" class="picker-quest-list">${items.map(buildCard).join('')}
                            <div id="orion-no-quests" style="display: none; margin: auto; text-align: center; color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                没有可用的任务
                            </div>
                        </div>
                        <div id="orion-orb-total" class="orb-total"></div>
                        <div class="picker-actions">
                            <button type="button" class="quest-pick-btn deselect" id="select-all-btn">取消全选</button>
                            <button type="submit" class="quest-pick-btn start" id="start-btn">${ICONS.BOLT} <span id="start-btn-text">开始 (${items.length})</span></button>
                        </div>
                    </form>`;
                const form = document.getElementById('orion-picker-form');
                const selectAllBtn = document.getElementById('select-all-btn');
                const startBtn = document.getElementById('start-btn');
                const getVisibleCheckboxes = () => Array.from(form.querySelectorAll('.quest-pick input[type="checkbox"]'))
                    .filter(cb => !cb.closest('.quest-pick').classList.contains('hidden'));
                let balanceText = '';
                const syncUI = () => {
                    const visibleCbs = getVisibleCheckboxes();
                    const totalChecked = visibleCbs.filter(cb => cb.checked).length;
                    const orbTotal = document.getElementById('orion-orb-total');
                    if (orbTotal) {
                        const picked = visibleCbs.filter(cb => cb.checked).map(cb => cb.closest('.quest-pick'));
                        const sum = attr => picked.reduce((total, el) => total + (Number(el?.getAttribute(attr)) || 0), 0);
                        const orbs = sum('data-orbs');
                        const selectedText = orbs > 0 ? `已选 ${fmtOrbs({ orbs, premium: sum('data-premium-orbs') })}` : '';
                        const text = [selectedText, balanceText].filter(Boolean).join(' · ');
                        orbTotal.textContent = text;
                        orbTotal.style.display = text ? 'block' : 'none';
                    }
                    const startBtnText = document.getElementById('start-btn-text');
                    if (startBtnText) startBtnText.textContent = `开始 (${totalChecked})`;
                    startBtn.disabled = totalChecked === 0;
                    if (visibleCbs.length === 0) {
                        selectAllBtn.disabled = true;
                        selectAllBtn.textContent = '全选';
                    } else {
                        selectAllBtn.disabled = false;
                        selectAllBtn.textContent = visibleCbs.every(cb => cb.checked) ? '取消全选' : '全选';
                    }
                    const noQuestsMsg = document.getElementById('orion-no-quests');
                    if (noQuestsMsg) {
                        noQuestsMsg.style.display = visibleCbs.length === 0 ? 'block' : 'none';
                    }
                };
                form.addEventListener('change', (e) => { if (e.target.name === 'quests') syncUI(); });
                const activeRewards = new Set([...rewardTypes.keys()].map(String));
                const activeTypes = new Set([...questTypes]);
                const applyFilters = () => {
                    form.querySelectorAll('.quest-pick').forEach(el => {
                        const rt = el.getAttribute('data-rt');
                        const qt = el.getAttribute('data-qt');
                        el.classList.toggle('hidden', !(activeRewards.has(rt) && activeTypes.has(qt)));
                    });
                    syncUI();
                };
                const FILTER_KINDS = [
                    { cls: 'reward-filter', attr: 'data-rt', set: activeRewards },
                    { cls: 'type-filter', attr: 'data-qt', set: activeTypes }
                ];
                form.addEventListener('click', (e) => {
                    const kind = FILTER_KINDS.find(k => e.target.classList.contains(k.cls));
                    if (kind) {
                        e.preventDefault();
                        const value = e.target.getAttribute(kind.attr);
                        e.target.classList.toggle('off');
                        if (e.target.classList.contains('off')) kind.set.delete(value);
                        else kind.set.add(value);
                        applyFilters();
                        return;
                    }
                    if (e.target.id === 'select-all-btn') {
                        e.preventDefault();
                        const visibleCbs = getVisibleCheckboxes();
                        if (visibleCbs.length === 0) return;
                        const shouldCheck = !visibleCbs.every(cb => cb.checked);
                        visibleCbs.forEach(cb => { cb.checked = shouldCheck; });
                        syncUI();
                    }
                });
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const selected = getVisibleCheckboxes().filter(cb => cb.checked);
                    if (selected.length === 0) return;
                    const data = new FormData(form);
                    closePicker({
                        selectedQuests: new Set(selected.map(cb => cb.value)),
                        autoEnroll: data.has('autoEnroll'),
                        autoClaim: data.has('autoClaim'),
                        playSound: data.has('playSound'),
                        randomDelay: data.has('randomDelay')
                    });
                });
                body.classList.add('picker-mode');
                syncUI();
                readOrbBalance()
                    .then(balance => {
                        if (balance === null) {
                            Logger.log('[系统] Discord 未返回宝珠余额，因此选择器不显示余额。', 'warn');
                            return;
                        }
                        balanceText = `账号上有 ${balance} 个宝珠`;
                        syncUI();
                    })
                    .catch(e => Logger.log(`[系统] 无法读取宝珠余额：${e?.message ?? e}`, 'warn'));
            });
        }
    };
    const Traffic = {
        queue: [], processing: false,
        async enqueue(url, body) {
            if (!RUNTIME.running) return Promise.reject(new Error("已停止"));
            return new Promise((resolve, reject) => {
                this.queue.push({ url, body, resolve, reject, attempts: 0 });
                this.process();
            });
        },
        async process() {
            if (this.processing || this.queue.length === 0) return;
            this.processing = true;
            while (this.queue.length > 0) {
                if (!RUNTIME.running) {
                    this.queue.forEach(req => req.reject(new Error("已关闭")));
                    this.queue = [];
                    this.processing = false;
                    return;
                }
                const req = this.queue.shift();
                try {
                    const res = await Mods.API.post({ url: req.url, body: req.body });
                    req.resolve(res);
                } catch (e) {
                    const err = ErrorHandler.classify(e);
                    if (err.isRetryable && req.attempts < SYS.MAX_RETRIES) {
                        req.attempts++;
                        const delay = (e.body?.retry_after ?? Math.pow(2, req.attempts)) * 1000;
                        const isGlobal = e.body?.global === true;
                        Logger.log(`[网络] 第 ${req.attempts}/${SYS.MAX_RETRIES} 次重试，${(delay / 1000).toFixed(1)} 秒后（HTTP ${err.status}）`, 'warn');
                        const retryJitter = rnd(200, 800);
                        if (isGlobal) {
                            this.queue.unshift(req);
                            await sleep(delay + retryJitter);
                        } else {
                            setTimeout(() => {
                                if (RUNTIME.running) {
                                    this.queue.push(req);
                                    this.process();
                                } else {
                                    req.reject(new Error('已关闭'));
                                }
                            }, delay + retryJitter);
                        }
                    } else if (err.isClientError) {
                        Logger.log(`[网络] HTTP ${err.status}：${req.url}`, 'debug');
                        req.reject(e);
                    } else {
                        Logger.log(`[网络] 请求 ${req.url} 失败：${err.message}`, 'err');
                        req.reject(e);
                    }
                }
                await sleep(rnd(1200, 1800));
            }
            this.processing = false;
        }
    };
    let Mods = {};
    const Patcher = {
        games: [], real: {}, active: false,
        savedShowCurrentGame: null,
        _unhide: null,
        PATCHED: ['getRunningGames', 'getGameForPID', 'getVisibleGame', 'getVisibleRunningGames',
                  'getRunningDiscordApplicationIds', 'getCandidateGames'],
        init(Store) {
            if (!Store) return;
            this.real = {};
            for (const name of this.PATCHED) {
                if (typeof Store[name] === 'function') this.real[name] = Store[name];
            }
            const absent = this.PATCHED.filter(n => !this.real[n]);
            if (absent.length) Logger.log(`[补丁] 存储中缺少 ${absent.join('、')}，不对其打补丁。`, 'debug');
        },
        toggle(on) {
            const S = Mods.RunStore;
            const real = this.real;
            if (on && !this.active) {
                S.getRunningGames = () => [...real.getRunningGames.call(S), ...this.games];
                S.getGameForPID = (pid) => this.games.find(g => g.pid === pid) || real.getGameForPID.call(S, pid);
                if (real.getVisibleGame) S.getVisibleGame = () => this.games[0] ?? real.getVisibleGame.call(S);
                if (real.getVisibleRunningGames) S.getVisibleRunningGames = () => [...real.getVisibleRunningGames.call(S), ...this.games];
                if (real.getCandidateGames) S.getCandidateGames = () => [...real.getCandidateGames.call(S), ...this.games];
                if (real.getRunningDiscordApplicationIds) {
                    S.getRunningDiscordApplicationIds = () => {
                        const ids = real.getRunningDiscordApplicationIds.call(S);
                        const ours = this.games.map(g => String(g.id));
                        return ids instanceof Set ? new Set([...ids, ...ours]) : [...(ids ?? []), ...ours];
                    };
                }
                this.active = true;
            } else if (!on && this.active) {
                for (const [name, fn] of Object.entries(real)) S[name] = fn;
                this.active = false;
            }
        },
        syncPresenceSuppression() {
            const setting = Mods.ShowCurrentGame;
            const shouldSuppress = CONFIG.HIDE_ACTIVITY && this.games.length > 0;
            if (!setting) {
                if (shouldSuppress) Logger.log('[补丁] 未找到 status.showCurrentGame，无法隐藏活动状态。', 'warn');
                return;
            }
            if (shouldSuppress && this.savedShowCurrentGame === null) {
                try {
                    this.savedShowCurrentGame = setting.getSetting() !== false;
                    if (this.savedShowCurrentGame) {
                        Promise.resolve(setting.updateSetting(false)).catch(e =>
                            Logger.log(`[补丁] 无法关闭 showCurrentGame，活动状态将保持可见：${e.message}`, 'warn'));
                        this._unhide = () => { try { setting.updateSetting(true); } catch (_) { } };
                        window.addEventListener('pagehide', this._unhide);
                        Logger.log('[补丁] 任务运行期间你的「将当前活动显示为状态」设置已关闭。点击「停止」会恢复它。如果在那之前关闭或刷新了 Discord，请在 Discord 设置中手动重新开启。', 'warn');
                    }
                } catch (e) {
                    this.savedShowCurrentGame = null;
                    Logger.log(`[补丁] 读取 showCurrentGame 失败，无法隐藏活动状态：${e.message}`, 'warn');
                }
            } else if (!shouldSuppress && this.savedShowCurrentGame !== null) {
                const restore = this.savedShowCurrentGame;
                this.savedShowCurrentGame = null;
                if (this._unhide) { window.removeEventListener('pagehide', this._unhide); this._unhide = null; }
                if (restore) {
                    try {
                        Promise.resolve(setting.updateSetting(true)).catch(e =>
                            Logger.log(`[补丁] 恢复 showCurrentGame 失败。请在 Discord 设置中重新开启"将当前活动显示为状态"：${e.message}`, 'err'));
                    } catch (e) {
                        Logger.log(`[补丁] 恢复 showCurrentGame 失败。请在 Discord 设置中重新开启"将当前活动显示为状态"：${e.message}`, 'err');
                    }
                }
            }
        },
        add(g) {
            if (this.games.some(x => x.pid === g.pid)) return;
            this.games.push(g);
            this.toggle(true);
            this.syncPresenceSuppression();
            this.dispatch([g], []);
            this.rpc(g);
        },
        remove(g) {
            const before = this.games.length;
            this.games = this.games.filter(x => x.pid !== g.pid);
            if (this.games.length === before) return;
            this.dispatch([], [g]);
            this.syncPresenceSuppression();
            if (!this.games.length) {
                this.toggle(false);
                this.rpc(null);
            } else {
                this.rpc(this.games[0]);
            }
        },
        dispatch(added, removed) {
            Mods.Dispatcher?.dispatch({
                type: CONST.EVT.GAME,
                added,
                removed,
                games: Mods.RunStore.getRunningGames()
            });
        },
        rpc(g) {
            if (CONFIG.HIDE_ACTIVITY && g) return;
            try {
                Mods.Dispatcher?.dispatch({
                    type: CONST.EVT.RPC,
                    socketId: null,
                    pid: g ? g.pid : 9999,
                    activity: g ? {
                        application_id: g.id,
                        name: g.name,
                        type: 0,
                        details: null,
                        state: null,
                        timestamps: { start: g.start },
                        icon: g.icon,
                        assets: null
                    } : null
                });
            } catch (e) {
                Logger.log(`[RPC 清理] ${e.message}`, 'debug');
            }
        },
        clean() {
            this.games = [];
            this.toggle(false);
            this.syncPresenceSuppression();
            this.rpc(null);
        }
    };
    const describeHeartbeatError = payload => {
        const e = payload?.error ?? payload;
        const parts = [];
        const status = e?.status ?? e?.httpStatus;
        if (status) parts.push(`HTTP ${status}`);
        const code = e?.body?.code ?? e?.code;
        if (code != null && code !== status) parts.push(`代码 ${code}`);
        const message = e?.body?.message ?? e?.message;
        if (message) parts.push(String(message));
        if (!parts.length) {
            try { parts.push(JSON.stringify(e).slice(0, 160)); } catch { parts.push(String(e)); }
        }
        return parts.join(', ') || '无详细信息';
    };
    const Tasks = {
        skipped: new Set(),
        outcomes: new Map(),
        _streamReal: undefined,
        _streamSpoofs: 0,
        readProgress(userStatus, key) {
            const p = userStatus?.progress;
            const entry = p instanceof Map ? p.get(key) : p?.[key];
            return entry?.value ?? userStatus?.streamProgressSeconds ?? 0;
        },
        sanitize(name) { return name.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, " "); },
        appIdFor(cfg, keyName, legacyAppId) {
            return taskAt(cfg?.tasks, keyName)?.applications?.[0]?.id ?? legacyAppId ?? null;
        },
        detectType(cfg, applicationId) {
            const keys = taskKeys(cfg.tasks);
            const typeMap = [
                { match: k => k === "ACHIEVEMENT_IN_ACTIVITY", type: "ACHIEVEMENT" },
                { match: k => k === "PLAY_ACTIVITY", type: "ACTIVITY" },
                { match: k => k.includes("VIDEO"), type: "WATCH_VIDEO", prefer: ["WATCH_VIDEO"] },
                { match: k => k.startsWith("PLAY"), type: "GAME", prefer: ["PLAY_ON_DESKTOP"] },
                { match: k => k.startsWith("STREAM"), type: "STREAM", prefer: ["STREAM_ON_DESKTOP"] },
                { match: k => k.includes("ACTIVITY"), type: "ACTIVITY" }
            ];
            for (const { match, type, prefer } of typeMap) {
                const keyName = (prefer && keys.find(k => prefer.includes(k)))
                    || keys.find(k => match(k) && !CONSOLE_ONLY_KEYS.has(k));
                if (keyName) {
                    return {
                        type, keyName,
                        target: taskAt(cfg.tasks, keyName)?.target ?? 0,
                        appId: this.appIdFor(cfg, keyName, applicationId)
                    };
                }
            }
            if (keys.length > 0 && keys.every(k => CONSOLE_ONLY_KEYS.has(k))) return null;
            if (applicationId) {
                return {
                    type: "GAME", keyName: "PLAY_ON_DESKTOP",
                    target: taskAt(cfg.tasks, keys[0])?.target ?? 0,
                    appId: applicationId
                };
            }
            return null;
        },
        async fetchGameData(appId, appName) {
            try {
                const res = await Mods.API.get({ url: `/applications/public?application_ids=${appId}` });
                const appData = res?.body?.[0];
                const exeEntry = appData?.executables?.find(x => x.os === "win32");
                const rawExe = exeEntry ? exeEntry.name.replace(">", "") : `${this.sanitize(appName)}.exe`;
                const cleanName = this.sanitize(appData?.name || appName);
                return {
                    name: appData?.name || appName,
                    icon: appData?.icon,
                    exeName: rawExe,
                    cmdLine: `C:\\Program Files\\${cleanName}\\${rawExe}`,
                    exePath: `c:/program files/${cleanName.toLowerCase()}/${rawExe}`,
                    id: appId
                };
            } catch (e) {
                Logger.log(`[获取游戏] ${appName} 使用兜底方案：${e?.message ?? e}`, 'debug');
                const cleanName = this.sanitize(appName);
                const safeExe = `${cleanName.replace(/\s+/g, "")}.exe`;
                return {
                    name: appName, exeName: safeExe,
                    cmdLine: `C:\\Program Files\\${cleanName}\\${safeExe}`,
                    exePath: `c:/program files/${cleanName.toLowerCase()}/${safeExe}`,
                    id: appId
                };
            }
        },
        async claimReward(questId) {
            return await Mods.API.post({
                url: `/quests/${questId}/claim-reward`,
                body: { platform: 0, location: 11, is_targeted: false, metadata_sealed: null, traffic_metadata_sealed: sealedFor(questId) }
            });
        },
        failTask(q, t, reason) {
            const currentProgress = Logger.tasks.get(q.id)?.cur ?? 0;
            Logger.updateTask(q.id, { name: t.name, type: t.type, cur: currentProgress, max: t.target, status: "FAILED" });
            Logger.log(`[任务] 已中止 "${t.name}"：${reason}`, 'err');
            Tasks.skipped.add(q.id);
            recordOutcome(Tasks.outcomes, q.id, 'failed');
            setTimeout(() => Logger.removeTask(q.id), 2000);
        },
        async VIDEO(q, t, s) {
            let cur = s?.progress?.[t.keyName]?.value ?? s?.progress?.[t.type]?.value ?? 0;
            let failCount = 0;
            Logger.updateTask(q.id, { name: t.name, type: "VIDEO", cur, max: t.target, status: "RUNNING" });
            const startTime = Date.now();
            let calls = 0;
            while (cur < t.target && RUNTIME.running) {
                const delayMs = rnd(7000, 9500);
                await sleep(delayMs);
                const elapsedSec = (delayMs / 1000) + (Math.random() * 0.02 - 0.01);
                cur += elapsedSec;
                const payloadTs = Number(Math.min(t.target, cur).toFixed(6));
                try {
                    const r = await Traffic.enqueue(`/quests/${q.id}/video-progress`, { timestamp: payloadTs });
                    calls++;
                    const serverVal = r?.body?.progress?.[t.keyName]?.value ?? r?.body?.progress?.WATCH_VIDEO?.value;
                    if (serverVal > cur) cur = Math.min(t.target, serverVal);
                    if (r?.body?.completed_at) break;
                    failCount = 0;
                } catch (e) {
                    failCount++;
                    const err = ErrorHandler.classify(e);
                    if (err.isClientError) {
                        Logger.log(`[任务] 视频任务不可用（HTTP ${err.status}），跳过。`, 'warn');
                        return Tasks.failTask(q, t, `客户端错误 ${err.status}`);
                    }
                    if (failCount >= SYS.MAX_TASK_FAILURES) {
                        return Tasks.failTask(q, t, '网络失败次数过多');
                    }
                    Logger.log(`[任务] 视频进度上报失败（${failCount}/${SYS.MAX_TASK_FAILURES}）：${err.message}`, 'debug');
                }
                Logger.updateTask(q.id, { name: t.name, type: "VIDEO", cur, max: t.target, status: "RUNNING" });
                if (Date.now() - startTime > SYS.MAX_TIME) {
                    return Tasks.failTask(q, t, '已超时');
                }
            }
            if (RUNTIME.running) {
                Logger.log(`[任务] 视频任务 "${t.name}" 完成，共 ${calls} 次接口调用`, 'debug');
                Tasks.finish(q, t);
            }
        },
        GAME(q, t, s) { return Tasks.generic(q, t, "GAME", "PLAY_ON_DESKTOP", s); },
        STREAM(q, t, s) { return Tasks.generic(q, t, "STREAM", "STREAM_ON_DESKTOP", s); },
        async generic(q, t, type, fallbackKey, s) {
            if (!RUNTIME.running) return;
            const key = t.keyName || fallbackKey;
            const gameData = await this.fetchGameData(t.appId, t.name);
            if (!RUNTIME.running) return;
            return new Promise(resolve => {
                const pid = rnd(2500, 12500) * 4;
                const game = {
                    id: gameData.id, name: gameData.name, icon: gameData.icon,
                    pid, pidPath: [pid], processName: gameData.name, start: Date.now(),
                    exeName: gameData.exeName, exePath: gameData.exePath, cmdLine: gameData.cmdLine,
                    executables: [{ os: 'win32', name: gameData.exeName, is_launcher: false }],
                    windowHandle: 0, fullscreenType: 0, overlay: true, sandboxed: false,
                    hidden: false, isLauncher: false
                };
                let cleanupHook;
                let cleaned = false;
                let safetyTimer;
                let watchdogTimer;
                let beats = 0;
                let failedBeats = 0;
                let consecutiveFailures = 0;
                let lastFailure = null;
                if (type === "STREAM") {
                    if (Mods.StreamStore) {
                        if (Tasks._streamSpoofs === 0) Tasks._streamReal = Mods.StreamStore.getStreamerActiveStreamMetadata;
                        Tasks._streamSpoofs++;
                        Mods.StreamStore.getStreamerActiveStreamMetadata = () => ({ id: gameData.id, pid, sourceName: gameData.name });
                    }
                    cleanupHook = () => {
                        if (Mods.StreamStore && Tasks._streamSpoofs > 0 && --Tasks._streamSpoofs === 0) {
                            Mods.StreamStore.getStreamerActiveStreamMetadata = Tasks._streamReal;
                        }
                    };
                } else {
                    Patcher.add(game);
                    cleanupHook = () => Patcher.remove(game);
                }
                const seeded = Tasks.readProgress(s, key);
                Logger.updateTask(q.id, { name: t.name, type, cur: seeded, max: t.target, status: "RUNNING" });
                Logger.log(`[任务] 已开始 ${type}：${gameData.name}`, 'info');
                const finish = () => {
                    if (cleaned) return;
                    cleaned = true;
                    clearTimeout(safetyTimer);
                    clearTimeout(watchdogTimer);
                    try { cleanupHook(); } catch (e) { Logger.log(`[任务] 清理：${e.message}`, 'debug'); }
                    try { Mods.Dispatcher?.unsubscribe(CONST.EVT.HEARTBEAT, check); } catch (e) {
                        Logger.log(`[分发器] 取消订阅失败：${e.message}`, 'debug');
                    }
                    try { Mods.Dispatcher?.unsubscribe(CONST.EVT.HEARTBEAT_FAIL, onFail); } catch (e) {
                        Logger.log(`[分发器] 取消订阅失败：${e.message}`, 'debug');
                    }
                    RUNTIME.cleanups.delete(abort);
                };
                const abort = () => { finish(); resolve(); };
                safetyTimer = setTimeout(() => {
                    if (RUNTIME.running) Tasks.failTask(q, t, '已超时（25 分钟）');
                    finish();
                    resolve();
                }, SYS.MAX_TIME);
                const armWatchdog = () => {
                    clearTimeout(watchdogTimer);
                    watchdogTimer = setTimeout(() => {
                        if (cleaned || !RUNTIME.running) return;
                        const failureTail = failedBeats > 0
                            ? `，另有 ${failedBeats} 次心跳失败，最后一次：${lastFailure}`
                            : '';
                        Logger.log(beats === 0
                            ? (failedBeats > 0
                                ? `[任务] Discord 从未上报 "${t.name}" 的进度。它尝试的 ${failedBeats} 次心跳全部失败，最后一次：${lastFailure}。`
                                : `[任务] Discord 从未上报 "${t.name}" 的进度。该客户端不接受注入的进程，继续等待没有意义。`)
                            : `[任务] Discord 在上报 ${beats} 次更新后停止上报 "${t.name}" 的进度${failureTail}。直接放弃，不再空等。`, 'err');
                        Tasks.failTask(q, t, failedBeats > 0
                            ? `Discord 未发来心跳（${failedBeats} 次失败）`
                            : 'Discord 未发来心跳');
                        finish();
                        resolve();
                    }, SYS.HEARTBEAT_GRACE);
                };
                armWatchdog();
                const check = (d) => {
                    if (!RUNTIME.running) { finish(); resolve(); return; }
                    if (d?.questId !== q.id) return;
                    beats++;
                    consecutiveFailures = 0;
                    armWatchdog();
                    const prog = Tasks.readProgress(d.userStatus, key);
                    Logger.updateTask(q.id, {
                        name: t.name, type, cur: prog, max: t.target, status: "RUNNING",
                        serverCur: prog, serverAt: Date.now()
                    });
                    if (prog >= t.target) {
                        finish();
                        Tasks.finish(q, t);
                        resolve();
                    }
                };
                const onFail = (d) => {
                    if (!RUNTIME.running) { finish(); resolve(); return; }
                    if (d?.questId !== q.id) return;
                    failedBeats++;
                    consecutiveFailures++;
                    lastFailure = describeHeartbeatError(d);
                    if (consecutiveFailures >= SYS.MAX_TASK_FAILURES) {
                        Logger.log(`[任务] "${t.name}" 的 Discord 心跳连续失败 ${consecutiveFailures} 次：${lastFailure}。直接放弃，不再等待看门狗超时。`, 'err');
                        Tasks.failTask(q, t, `Discord 无法上报进度（${lastFailure}）`);
                        finish();
                        resolve();
                        return;
                    }
                    Logger.log(`[任务] "${t.name}" 的 Discord 心跳失败（${consecutiveFailures}/${SYS.MAX_TASK_FAILURES}）：${lastFailure}`, 'debug');
                    if (beats > 0) armWatchdog();
                };
                Mods.Dispatcher?.subscribe(CONST.EVT.HEARTBEAT, check);
                Mods.Dispatcher?.subscribe(CONST.EVT.HEARTBEAT_FAIL, onFail);
                RUNTIME.cleanups.add(abort);
            });
        },
        _relayUrl: 'http://127.0.0.1:43210',
        _relayProbe: null,
        _relayProbeAt: 0,
        RELAY_PROBE_TTL: 60000,
        _probeRelay() {
            if (this._relayProbe && Date.now() - this._relayProbeAt < this.RELAY_PROBE_TTL) return this._relayProbe;
            this._relayProbeAt = Date.now();
            return this._relayProbe = (async () => {
                try {
                    const r = await Promise.race([
                        fetch(`${this._relayUrl}/health`, { method: 'GET', redirect: 'error' }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('探测超时')), 800))
                    ]);
                    if (!RUNTIME.running) return false;
                    if (r.ok) Logger.log('[绕过] 检测到 127.0.0.1:43210 上的 Orion 中继。', 'info');
                    return r.ok;
                } catch (_) {
                    return false;
                }
            })();
        },
        async _bypassPost(url, headers, jsonBody) {
            const relayAvailable = await this._probeRelay();
            if (!RUNTIME.running) throw new Error('已关闭');
            if (relayAvailable) {
                let r;
                try {
                    r = await fetch(`${this._relayUrl}/proxy`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url, headers, body: jsonBody }),
                        redirect: 'error'
                    });
                    if (!RUNTIME.running) throw new Error('已关闭');
                } catch (e) {
                    if (!RUNTIME.running) throw e;
                    this._relayProbe = null;
                    Logger.log(`[绕过] 中继停止响应，改用其他传输方式：${e?.message ?? e}`, 'debug');
                }
                if (r) {
                    if (!r.ok) {
                        const body = await r.text();
                        if (!RUNTIME.running) throw new Error('已关闭');
                        throw { status: r.status, body };
                    }
                    const result = await r.json();
                    if (!RUNTIME.running) throw new Error('已关闭');
                    if (!result.ok) throw { status: result.status, body: result.body };
                    return result;
                }
            }
            try {
                const helper = window.VencordNative?.pluginHelpers?.OrionQuests;
                if (helper) {
                    const u = new URL(url);
                    const appId = u.hostname.split('.')[0];
                    const questId = headers['X-Discord-Quest-ID'];
                    const referrer = headers['Referer'];
                    if (u.pathname.endsWith('/acf/authorize')) {
                        const { code } = JSON.parse(jsonBody);
                        const r = await helper.discordsaysAuthorize({ appId, questId, authCode: code, referrer });
                        if (!RUNTIME.running) throw new Error('已关闭');
                        if (!r.ok) throw { status: r.status, body: r.body };
                        return { ok: true, status: r.status, body: r.body };
                    }
                    if (u.pathname.endsWith('/acf/quest/progress')) {
                        const { progress } = JSON.parse(jsonBody);
                        const token = headers['X-Auth-Token'];
                        const r = await helper.discordsaysProgress({ appId, questId, token, target: progress, referrer });
                        if (!RUNTIME.running) throw new Error('已关闭');
                        if (!r.ok) throw { status: r.status, body: r.body };
                        return { ok: true, status: r.status, body: r.body };
                    }
                }
            } catch (e) {
                if (!RUNTIME.running) throw e;
                if (e?.status) throw e;
                Logger.log(`[绕过] VencordNative 通道出错：${e?.message ?? e}`, 'debug');
            }
            const dn = window.DiscordNative;
            if (dn) {
                const probes = [
                    () => dn.http?.makeRequest,
                    () => dn.app?.makeRequest,
                ];
                for (const probe of probes) {
                    if (!RUNTIME.running) throw new Error('已关闭');
                    try {
                        const fn = probe();
                        if (typeof fn === 'function') {
                            const r = await fn.call(dn, { method: 'POST', url, headers, body: jsonBody });
                            if (!RUNTIME.running) throw new Error('已关闭');
                            if (r && (r.status || r.statusCode)) {
                                const status = r.status ?? r.statusCode;
                                return { ok: status >= 200 && status < 300, status, body: r.body ?? r.responseText ?? '' };
                            }
                        }
                    } catch (e) {
                        if (!RUNTIME.running) throw e;
                    }
                }
            }
            if (!RUNTIME.running) throw new Error('已关闭');
            const res = await fetch(url, { method: 'POST', headers, body: jsonBody, redirect: 'error' });
            if (!RUNTIME.running) throw new Error('已关闭');
            const body = await res.text();
            if (!RUNTIME.running) throw new Error('已关闭');
            if (!res.ok) throw { status: res.status, body };
            return { ok: true, status: res.status, body };
        },
        async bypassAchievement(q, t) {
            const appId = t.appId || q.config?.application?.id;
            let reason = null;
            if (!appId) {
                reason = '该任务没有应用 ID，没有可授权的对象';
                return { ok: false, reason };
            }
            if (!/^\d+$/.test(String(appId))) {
                reason = `该任务的应用 ID（"${appId}"）不是纯数字，因此在任何请求发出前就被拒绝`;
                Logger.log(`[绕过] 拒绝非数字的 appId "${appId}"。`, 'warn');
                return { ok: false, reason };
            }
            let preGrantIds;
            try {
                const before = await Mods.API.get({ url: '/oauth2/tokens' });
                if (!RUNTIME.running) return { ok: false, reason };
                preGrantIds = new Set((before?.body || []).filter(tk => tk.application?.id === appId).map(tk => tk.id));
            } catch (e) {
                if (!RUNTIME.running) return { ok: false, reason };
                Logger.log(`[绕过] 无法快照已有授权，直接中止，以免留下无法撤销的授权：${e?.message}`, 'warn');
                return { ok: false, reason };
            }
            try {
                let appName = null;
                try {
                    const a = await Mods.API.get({ url: `/applications/public?application_ids=${appId}` });
                    if (!RUNTIME.running) return { ok: false, reason };
                    appName = a?.body?.[0]?.name ?? null;
                } catch (_) {
                    if (!RUNTIME.running) return { ok: false, reason };
                }
                const consented = await Consent.ask(appId, appName);
                if (!RUNTIME.running) return { ok: false, reason };
                if (!consented) {
                    Logger.log(`[绕过] 已拒绝对 "${t.name}" 的授权确认，不会授权该应用。`, 'warn');
                    return { ok: false, reason };
                }
                Logger.log(`[绕过] 正在为 "${t.name}" 尝试 Discord Says 授权流程...`, 'info');
                const authRes = await Mods.API.post({
                    url: '/oauth2/authorize',
                    query: {
                        response_type: 'code',
                        client_id: appId,
                        scope: 'identify applications.commands applications.entitlements'
                    },
                    body: {
                        permissions: '0',
                        authorize: true,
                        integration_type: 1,
                        location_context: { guild_id: '10000', channel_id: '10000', channel_type: 10000 }
                    }
                });
                if (!RUNTIME.running) return { ok: false, reason };
                const location = authRes?.body?.location;
                if (!location) throw new Error('/oauth2/authorize 响应中没有 location');
                const authCode = new URL(location).searchParams.get('code');
                if (!authCode) throw new Error('授权 location 中没有 code');
                const ticketRes = await Mods.API.post({ url: `/applications/${appId}/proxy-tickets`, body: {} });
                if (!RUNTIME.running) return { ok: false, reason };
                const proxyTicket = ticketRes?.body?.ticket;
                if (!proxyTicket) throw new Error('没有代理票据');
                const referrer = `https://${appId}.discordsays.com/?instance_id=example-cl-instance&platform=desktop&discord_proxy_ticket=${encodeURIComponent(proxyTicket)}`;
                const dsAuthRes = await Tasks._bypassPost(
                    `https://${appId}.discordsays.com/.proxy/acf/authorize`,
                    { 'Content-Type': 'application/json', 'X-Auth-Token': '', 'X-Discord-Quest-ID': q.id, 'Referer': referrer },
                    JSON.stringify({ code: authCode })
                );
                if (!RUNTIME.running) return { ok: false, reason };
                let dsToken;
                try { dsToken = JSON.parse(dsAuthRes.body)?.token; }
                catch { throw new Error('discordsays 返回的不是 JSON：' + String(dsAuthRes.body).slice(0, 120)); }
                if (!dsToken) throw new Error('没有 discordsays 令牌');
                await Tasks._bypassPost(
                    `https://${appId}.discordsays.com/.proxy/acf/quest/progress`,
                    { 'Content-Type': 'application/json', 'X-Auth-Token': dsToken, 'X-Discord-Quest-ID': q.id, 'Referer': referrer },
                    JSON.stringify({ progress: t.target })
                );
                if (!RUNTIME.running) return { ok: false, reason };
                Logger.log(`[绕过] 成功，"${t.name}" 已通过 Discord Says 完成。`, 'success');
                return { ok: true, reason: null };
            } catch (e) {
                if (!RUNTIME.running) return { ok: false, reason };
                if (e instanceof TypeError && /failed to fetch|networkerror/i.test(e.message)) {
                    Logger.log(`[绕过] Discord 的 CSP 阻止脚本访问 discordsays.com。自动绕过请使用 Vencord 插件版本，用户脚本无法绕过 CSP。跳过 "${t.name}"。`, 'warn');
                    return { ok: false, reason };
                }
                const code = e?.body?.code;
                if (code === 50165) {
                    reason = '该活动有年龄限制或已下架，Discord 拒绝为该账号发放代理票据';
                    Logger.log(`[绕过] "${t.name}" 无法启动（有年龄限制或已下架）。Discord 拒绝发放代理票据，无能为力。`, 'warn');
                    return { ok: false, reason };
                }
                const parts = [];
                if (e?.status) parts.push(`HTTP ${e.status}`);
                if (code) parts.push(`代码 ${code}`);
                if (e?.body?.message) parts.push(e.body.message);
                else if (e?.message) parts.push(e.message);
                else if (typeof e === 'string') parts.push(e);
                else if (e) { try { parts.push(JSON.stringify(e).slice(0, 200)); } catch { parts.push(String(e)); } }
                reason = `Discord Says 绕过失败（${parts.join('，') || '未知错误'}）`;
                Logger.log(`[绕过] 失败：${parts.join('，') || '未知'}`, 'warn');
                return { ok: false, reason };
            } finally {
                if (preGrantIds) {
                    try {
                        const after = await Mods.API.get({ url: '/oauth2/tokens' });
                        const ours = (after?.body || []).filter(tk => tk.application?.id === appId && !preGrantIds.has(tk.id));
                        for (const g of ours) await Mods.API.del({ url: `/oauth2/tokens/${g.id}` });
                    } catch (e) {
                        Logger.log(`[绕过] 撤销授权的清理步骤（非致命错误）：${e?.message}`, 'debug');
                    }
                }
            }
        },
        async ACHIEVEMENT(q, t) {
            Logger.updateTask(q.id, { name: t.name, type: "ACHIEVEMENT", cur: 0, max: t.target, status: "RUNNING" });
            const key = buildStreamKey();
            if (key) {
                Logger.log(`[任务] 正在为 "${t.name}" 尝试心跳伪造...`, 'info');
                const beat = { stream_key: key, application_id: String(t.appId || ''), terminal: false };
                let cur = 0;
                let failCount = 0;
                while (cur < t.target && RUNTIME.running) {
                    try {
                        const r = await Traffic.enqueue(`/quests/${q.id}/heartbeat`, beat);
                        if (!RUNTIME.running) return;
                        cur = r?.body?.progress?.[t.keyName]?.value ?? r?.body?.progress?.ACHIEVEMENT_IN_ACTIVITY?.value ?? cur;
                        Logger.updateTask(q.id, { name: t.name, type: "ACHIEVEMENT", cur, max: t.target, status: "RUNNING" });
                        failCount = 0;
                        if (cur >= t.target) {
                            try { await Traffic.enqueue(`/quests/${q.id}/heartbeat`, { ...beat, terminal: true }); }
                            catch (_) { }
                            break;
                        }
                    } catch (e) {
                        if (!RUNTIME.running) return;
                        failCount++;
                        const err = ErrorHandler.classify(e);
                        if (err.isClientError) {
                            Logger.log(`[成就] 心跳被拒绝（HTTP ${err.status}），改为被动模式。`, 'warn');
                            break;
                        }
                        if (failCount >= SYS.MAX_TASK_FAILURES) {
                            Logger.log(`[成就] 失败次数过多，改为被动模式。`, 'warn');
                            break;
                        }
                    }
                    await sleep(rnd(19000, 22000));
                }
                if (cur >= t.target && RUNTIME.running) return Tasks.finish(q, t);
            }
            if (!RUNTIME.running) return;
            const bypass = await Tasks.bypassAchievement(q, t);
            if (!RUNTIME.running) return;
            if (bypass.ok) return Tasks.finish(q, t);
            Logger.log(`[任务] 跳过 "${t.name}"。所有自动完成途径都失败（心跳被拒绝、绕过被拦截），该任务在你的账号上可能有年龄限制或已下架。`, 'warn');
            return Tasks.failTask(q, t, bypass.reason ?? '所有自动完成途径都失败了');
        },
        async ACTIVITY(q, t) {
            const key = buildStreamKey();
            if (!key) {
                return Tasks.failTask(q, t, '未找到语音频道');
            }
            const beat = { stream_key: key, application_id: String(t.appId || ''), terminal: false };
            let cur = 0;
            let failCount = 0;
            let stalledBeats = 0;
            Logger.updateTask(q.id, { name: t.name, type: "ACTIVITY", cur, max: t.target, status: "RUNNING" });
            const startTime = Date.now();
            while (cur < t.target && RUNTIME.running) {
                try {
                    const r = await Traffic.enqueue(`/quests/${q.id}/heartbeat`, beat);
                    const reported = r?.body?.progress?.[t.keyName]?.value ?? r?.body?.progress?.PLAY_ACTIVITY?.value;
                    if (typeof reported === 'number') { cur = reported; stalledBeats = 0; }
                    else if (++stalledBeats >= SYS.MAX_TASK_FAILURES) return Tasks.failTask(q, t, 'Discord 未计入任何进度');
                    Logger.updateTask(q.id, { name: t.name, type: "ACTIVITY", cur, max: t.target, status: "RUNNING" });
                    failCount = 0;
                    if (cur >= t.target) {
                        try { await Traffic.enqueue(`/quests/${q.id}/heartbeat`, { ...beat, terminal: true }); }
                        catch (e) { Logger.log(`[活动] 最后一次心跳失败：${e?.message}`, 'debug'); }
                        break;
                    }
                } catch (e) {
                    failCount++;
                    const err = ErrorHandler.classify(e);
                    if (err.isClientError) {
                        Logger.log(`[任务] 活动任务不可用（HTTP ${err.status}），跳过。`, 'warn');
                        return Tasks.failTask(q, t, `客户端错误 ${err.status}`);
                    }
                    if (failCount >= SYS.MAX_TASK_FAILURES) {
                        return Tasks.failTask(q, t, '网络失败次数过多');
                    }
                    Logger.log(`[任务] 活动心跳失败（${failCount}/${SYS.MAX_TASK_FAILURES}）：${err.message}`, 'debug');
                }
                if (Date.now() - startTime > SYS.MAX_TIME) {
                    return Tasks.failTask(q, t, '已超时');
                }
                await sleep(rnd(19000, 22000));
            }
            if (RUNTIME.running && cur >= t.target) Tasks.finish(q, t);
        },
        async finish(q, t) {
            Logger.updateTask(q.id, { name: t.name, type: t.type, cur: t.target, max: t.target, status: "COMPLETED" });
            recordOutcome(Tasks.outcomes, q.id, 'completed');
            Logger.log(`[任务] "${t.name}" 已完成！`, 'success');
            Sound.play('tick');
            try {
                if (typeof Notification !== 'undefined') {
                    if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (_) { } }
                    if (Notification.permission === 'granted') {
                        new Notification("Orion：任务完成", { body: t.name, icon: "https://cdn.discordapp.com/emojis/1120042457007792168.webp", tag: `orion-${q.id}` });
                    }
                }
            } catch (e) { Logger.log(`[通知] ${e.message}`, 'debug'); }
            if (RUNTIME.autoClaim) {
                try {
                    await sleep(rnd(2500, 6000));
                    if (!RUNTIME.running) return;
                    const claimRes = await this.claimReward(q.id);
                    if (claimRes?.body?.claimed_at) {
                        Logger.log(`[领取] "${t.name}" 的奖励已自动领取！`, 'success');
                        Logger.updateTask(q.id, { name: t.name, type: t.type, cur: t.target, max: t.target, status: "CLAIMED" });
                        setTimeout(() => Logger.removeTask(q.id), 2000);
                        return;
                    }
                } catch (e) {
                    const needsCaptcha = e?.body?.captcha_key || e?.body?.captcha_sitekey;
                    if (needsCaptcha) {
                        Logger.log(`[领取] "${t.name}" 需要验证码，请使用界面上的按钮。`, 'warn');
                    } else {
                        Logger.log(`[领取] "${t.name}" 自动领取失败：${e?.body?.message ?? e?.message}`, 'err');
                    }
                }
            }
            Logger.updateTask(q.id, { name: t.name, type: t.type, cur: t.target, max: t.target, status: "COMPLETED", claimable: true, questId: q.id });
        }
    };
    function findShowCurrentGameSetting(moduleCache) {
        if (!moduleCache) return undefined;
        let actions, delay, BoolValue;
        for (const m of Object.values(moduleCache)) {
            try {
                const exp = m?.exports;
                if (!exp || typeof exp !== 'object') continue;
                for (const key of Object.keys(exp)) {
                    const p = exp[key];
                    if (!p) continue;
                    if (!BoolValue && typeof p.create === 'function'
                        && String(p.typeName ?? '').includes('Bool')) BoolValue = p;
                    if (!actions && typeof p.updateAsync === 'function'
                        && (p.ProtoClass?.typeName?.endsWith('.PreloadedUserSettings') || p.type === 1)) {
                        actions = p;
                        delay = exp.UserSettingsDelay?.INFREQUENT_USER_ACTION ?? 0;
                    }
                }
                if (actions && BoolValue) break;
            } catch { }
        }
        if (!actions) return undefined;
        if (!BoolValue) Logger.log('[补丁] 未找到 BoolValue 原型类型。只有在设置项已存在的前提下才能隐藏活动状态。', 'debug');
        return {
            getSetting: () => actions.getCurrentValue?.()?.status?.showCurrentGame?.value,
            updateSetting: value => actions.updateAsync('status', settings => {
                if (settings.showCurrentGame && typeof settings.showCurrentGame.value === 'boolean') {
                    settings.showCurrentGame.value = value;
                } else if (BoolValue) {
                    settings.showCurrentGame = BoolValue.create({ value });
                } else {
                    throw new Error('未找到 BoolValue 原型类型');
                }
            }, delay)
        };
    }
    function loadModules() {
        try {
            if (typeof window.Vencord !== 'undefined' && window.Vencord.Webpack) {
                Logger.log('[系统] 检测到 Vencord，使用 Vencord Webpack API...', 'info');
                const W = window.Vencord.Webpack;
                let routerModule;
                try {
                    const m = W.findByCode('transitionTo -');
                    if (m) {
                        for (const prop of [m, m.default, ...Object.values(m)]) {
                            if (typeof prop === 'function' && prop.toString().includes('transitionTo -')) {
                                routerModule = { transitionTo: prop };
                                break;
                            }
                        }
                    }
                } catch (e) { }
                Mods = {
                    QuestStore: W.findStore('QuestStore') || W.findStore('QuestsStore'),
                    RunStore: W.findStore('RunningGameStore'),
                    StreamStore: W.findStore('ApplicationStreamingStore'),
                    ChanStore: W.findStore('ChannelStore'),
                    GuildChanStore: W.findStore('GuildChannelStore'),
                    UserStore: W.findStore('UserStore'),
                    OrbStore: W.findStore('VirtualCurrencyStore'),
                    Dispatcher: W.Common?.FluxDispatcher || W.findByProps('dispatch', 'subscribe', 'flushWaitQueue'),
                    API: W.Common?.RestAPI || W.findByProps('get', 'post', 'del'),
                    Router: routerModule,
                    ShowCurrentGame: findShowCurrentGameSetting(W.cache || W.wreq?.c)
                };
                const required = ['QuestStore', 'API', 'Dispatcher', 'RunStore'];
                const missing = required.filter(k => !Mods[k]);
                if (missing.length === 0) {
                    const optional =['StreamStore', 'ChanStore', 'GuildChanStore', 'Router'];
                    optional.forEach(k => { if (!Mods[k]) Logger.log(`[系统] 未找到可选模块 '${k}'，部分功能可能受限。`, 'warn'); });
                    Patcher.init(Mods.RunStore);
                    return true;
                }
                Logger.log(`[系统] Vencord 提取遗漏：${missing.join('、')}，回退到原生提取...`, 'warn');
            }
            if (typeof webpackChunkdiscord_app === 'undefined') {
                throw new Error("未找到 Webpack 模块块——是否在 Discord 中运行？");
            }
            let req;
            webpackChunkdiscord_app.push([[Symbol()], {}, (r) => {
                const cur = Object.keys(req?.c || {}).length;
                const incoming = Object.keys(r?.c || {}).length;
                if (incoming > cur) req = r;
            }]);
            webpackChunkdiscord_app.pop();
            if (!req?.c) throw new Error("模块注册表不可用——Discord 版本不兼容（见 issue #20）");
            const modules = Object.values(req.c);
            function findStore(storeName) {
                for (const m of modules) {
                    try {
                        const exp = m?.exports;
                        if (!exp || typeof exp !== 'object') continue;
                        for (const key of Object.keys(exp)) {
                            const prop = exp[key];
                            if (prop && typeof prop === 'object'
                                && prop.__proto__?.constructor?.displayName === storeName) {
                                return prop;
                            }
                        }
                    } catch { }
                }
                return undefined;
            }
            function findDispatcher() {
                for (const m of modules) {
                    try {
                        const exp = m?.exports;
                        if (!exp || typeof exp !== 'object') continue;
                        for (const key of Object.keys(exp)) {
                            const prop = exp[key];
                            if (prop && prop._subscriptions
                                && typeof prop.subscribe === 'function'
                                && typeof prop.dispatch === 'function'
                                && typeof prop.__proto__?.flushWaitQueue === 'function') {
                                return prop;
                            }
                        }
                    } catch { }
                }
                return undefined;
            }
            function findAPI() {
                for (const m of modules) {
                    try {
                        const exp = m?.exports;
                        if (!exp || typeof exp !== 'object') continue;
                        for (const key of Object.keys(exp)) {
                            const prop = exp[key];
                            if (prop && typeof prop.get === 'function'
                                && typeof prop.post === 'function'
                                && typeof prop.del === 'function'
                                && !prop._dispatcher) {
                                return prop;
                            }
                        }
                    } catch { }
                }
                return undefined;
            }
            function findRouter() {
                for (const m of modules) {
                    try {
                        const exp = m?.exports;
                        if (!exp) continue;
                        for (const prop of [exp, exp.default, ...Object.values(exp)]) {
                            if (typeof prop === 'function' && prop.toString().includes('transitionTo -')) {
                                return { transitionTo: prop };
                            }
                        }
                    } catch { }
                }
                return undefined;
            }
            Mods = {
                QuestStore: findStore('QuestStore'),
                RunStore: findStore('RunningGameStore'),
                StreamStore: findStore('ApplicationStreamingStore'),
                ChanStore: findStore('ChannelStore'),
                GuildChanStore: findStore('GuildChannelStore'),
                UserStore: findStore('UserStore'),
                OrbStore: findStore('VirtualCurrencyStore'),
                Dispatcher: findDispatcher(),
                API: findAPI(),
                Router: findRouter(),
                ShowCurrentGame: findShowCurrentGameSetting(req.c)
            };
            const required = ['QuestStore', 'API', 'Dispatcher', 'RunStore'];
            const missing = required.filter(k => !Mods[k]);
            if (missing.length > 0) throw new Error(`未找到核心模块：${missing.join('、')}`);
            const optional = ['StreamStore', 'ChanStore', 'GuildChanStore', 'Router'];
            optional.forEach(k => { if (!Mods[k]) Logger.log(`[系统] 未找到可选模块 '${k}'，部分功能可能受限。`, 'warn'); });
            Patcher.init(Mods.RunStore);
            return true;
        } catch (e) {
            Logger.log(`[系统] 模块加载出错：${e.message ?? e}`, 'err');
            console.error(e);
            return false;
        }
    }
    async function runConcurrent(tasks, limit) {
        const executing = new Set();
        for (const task of tasks) {
            if (!RUNTIME.running) break;
            const p = task().finally(() => executing.delete(p));
            executing.add(p);
            await sleep(rnd(1500, 4000));
            if (executing.size >= limit) {
                await Promise.race(executing);
            }
        }
        return Promise.allSettled(executing);
    }
    async function main() {
        Logger.init();
        if (!loadModules()) return Logger.log('[系统] 加载 Discord 模块失败，中止。', 'err');
        const getQuests = () => {
            const q = Mods.QuestStore.quests;
            return q instanceof Map ? [...q.values()] : Object.values(q);
        };
        if (!getQuests().length) {
            Logger.log('[系统] 正在等待 Discord 下发任务列表...', 'info');
            for (let waited = 0; waited < 15000 && !getQuests().length && RUNTIME.running; waited += 250) {
                await new Promise(r => setTimeout(r, 250));
            }
        }
        if (!RUNTIME.running) return;
        const allQuests = getQuests();
        let quests = allQuests.filter(q =>
            !q.userStatus?.completedAt
            && notExpired(q)
            && q.id !== CONST.ID
            && !Tasks.skipped.has(q.id)
        );
        if (!quests.length) {
            if (!allQuests.length) {
                Logger.log('[系统] Discord 未向该客户端下发任务列表。请按 Ctrl+R 重新加载 Discord 并重新粘贴脚本。', 'err');
            } else {
                Logger.log('[系统] 所有可用的任务都已完成！', 'success');
            }
            return Logger.shutdown();
        }
        const pickerResult = await Logger.showQuestPicker(quests);
        if (!RUNTIME.running) return;
        RUNTIME.autoEnroll = pickerResult.autoEnroll;
        RUNTIME.autoClaim = pickerResult.autoClaim;
        RUNTIME.playSound = pickerResult.playSound;
        RUNTIME.randomDelay = pickerResult.randomDelay;
        if (pickerResult.selectedQuests.size === 0) {
            Logger.log('[系统] 未选择任何任务，正在退出。', 'info');
            return Logger.shutdown();
        }
        let loopCount = 1;
        while (RUNTIME.running) {
            try {
                Logger.log(`[轮次] 开始第 ${loopCount} 轮...`, 'info');
                const suspendedUntil = questAccessSuspendedUntil();
                if (suspendedUntil) {
                    const when = suspendedUntil.getTime() === 0 ? '（暂时）' : `直到 ${suspendedUntil.toLocaleString()}`;
                    Logger.log(`[系统] Discord 已暂停该账号的任务访问权限 ${when}。其官方客户端在此状态下也会拒绝启动任务，因此 Orion 也停止运行。`, 'err');
                    break;
                }
                const blockedUntil = enrollmentBlockedUntil();
                if (blockedUntil) {
                    Logger.log(`[系统] Discord 已封禁该账号的任务接取权限，直到 ${blockedUntil.toLocaleString()}。直接停止，不再重试。`, 'err');
                    break;
                }
                quests = getQuests();
                const active = quests.filter(q =>
                    pickerResult.selectedQuests.has(q.id)
                    && !q.userStatus?.completedAt
                    && notExpired(q)
                    && q.id !== CONST.ID
                    && !Tasks.skipped.has(q.id)
                );
                if (!active.length) {
                    const summary = summarizeRun(Tasks.outcomes);
                    Logger.log(`[系统] ${summary.line}`, summary.blocked || summary.failed ? 'warn' : 'success');
                    if (summary.playDone) Sound.play('done');
                    break;
                }
                const queues = { video: [], game: [] };
                active.forEach(q => {
                    try {
                        const cfg = selectTaskConfig(q.config);
                        const questName = q.config?.messages?.questName ?? q.id;
                        const hasTaskConfig = !!cfg?.tasks && typeof cfg.tasks === 'object';
                        const typeData = hasTaskConfig ? Tasks.detectType(cfg, q.config?.application?.id) : null;
                        const blocker = questBlocker({
                            name: questName,
                            hasTaskConfig,
                            keys: hasTaskConfig ? taskKeys(cfg.tasks) : [],
                            typeData,
                            isDesktop: SYS.IS_DESKTOP
                        });
                        if (blocker) {
                            Logger.log(`[任务] ${blocker} 本次运行中不再尝试该任务。`, 'warn');
                            Tasks.skipped.add(q.id);
                            recordOutcome(Tasks.outcomes, q.id, 'blocked');
                            return;
                        }
                        const { type, keyName, target, appId } = typeData;
                        const tInfo = {
                            id: q.id,
                            appId: appId ?? 0,
                            name: q.config?.messages?.questName ?? "未知任务",
                            target,
                            type,
                            keyName
                        };
                        if (!q.userStatus?.enrolledAt && !RUNTIME.autoEnroll) {
                            Logger.updateTask(tInfo.id, {
                                name: tInfo.name, type: tInfo.type, cur: 0, max: tInfo.target,
                                status: "PENDING", actionRequired: 'ENROLL'
                            });
                            return;
                        }
                        if (Logger.tasks.has(q.id) && Logger.tasks.get(q.id).status === "RUNNING") return;
                        Logger.updateTask(tInfo.id, {
                            name: tInfo.name, type: tInfo.type, cur: 0, max: tInfo.target,
                            status: "QUEUE", actionRequired: null
                        });
                        const taskFunc = async () => {
                            if (!q.userStatus?.enrolledAt) {
                                Logger.log(`[接取] 正在接受任务：${tInfo.name}`, 'info');
                                try {
                                    await Traffic.enqueue(`/quests/${q.id}/enroll`, {
                                        location: 11,
                                        is_targeted: false,
                                        metadata_sealed: null,
                                        traffic_metadata_sealed: sealedFor(q.id)
                                    });
                                    await sleep(rnd(800, 1500));
                                } catch (e) {
                                    const err = ErrorHandler.classify(e);
                                    if (ErrorHandler.isSkippableQuest(e)) {
                                        Tasks.skipped.add(q.id);
                                        Logger.log(`[接取] ${tInfo.name} 不可用（${err.status}），跳过。`, 'warn');
                                    } else {
                                        Logger.log(`[接取] ${tInfo.name} 接取失败：${err.message}`, 'err');
                                    }
                                    return Tasks.failTask(q, tInfo, `接取失败`);
                                }
                            }
                            if (type === "WATCH_VIDEO") return Tasks.VIDEO(q, tInfo, q.userStatus);
                            if (type === "ACHIEVEMENT") return Tasks.ACHIEVEMENT(q, tInfo);
                            const runner = type === "STREAM" ? Tasks.STREAM : (type === "ACTIVITY" ? Tasks.ACTIVITY : Tasks.GAME);
                            return runner(q, tInfo, q.userStatus);
                        };
                        if (type === "WATCH_VIDEO") queues.video.push(taskFunc);
                        else queues.game.push(taskFunc);
                    } catch (e) {
                        Logger.log(`[任务] 处理 ${q.id} 时出错：${e.message}`, 'err');
                    }
                });
                const totalTasks = queues.video.length + queues.game.length;
                if (totalTasks > 0) {
                    Logger.log(`[轮次] 正在处理：${queues.video.length} 个视频任务，${queues.game.length} 个游戏任务。`, 'info');
                    const pGames = runConcurrent(queues.game, 1);
                    const pVideos = runConcurrent(queues.video, 2);
                    await Promise.all([pGames, pVideos]);
                } else {
                    if (active.length === 0) { Logger.log('[系统] 所有可用的任务都已完成！', 'success'); break; }
                    else await sleep(rnd(4000, 6000));
                }
                if (!RUNTIME.running) break;
                if (RUNTIME.randomDelay) {
                    const delayMs = rnd(60000, 1800000);
                    Logger.log(`[轮次] 第 ${loopCount} 轮结束。随机延迟 ${Math.round(delayMs / 60000)} 分钟后重新扫描。`, 'info');
                    await sleep(delayMs);
                } else {
                    Logger.log(`[轮次] 第 ${loopCount} 轮结束，等待后重新扫描...`, 'info');
                    await sleep(rnd(2500, 4500));
                }
                loopCount++;
            } catch (cycleError) {
                Logger.log(`[轮次] 第 ${loopCount} 轮出错：${cycleError?.message ?? cycleError}`, 'err');
                console.error(cycleError);
                await sleep(3000);
                loopCount++;
            }
        }
        const hasUnclaimed = [...Logger.tasks.values()].some(t => t.claimable && !t.removing);
        if (hasUnclaimed) {
            Logger.log('[系统] 任务循环已结束。请在上方领取奖励，然后点击「停止」。', 'info');
            return;
        }
        Logger.shutdown();
    }
    main().catch(e => {
        const msg = e?.message ?? e?.toString?.() ?? "未知致命错误";
        console.error('[Orion Fatal]', e);
        try { Logger.log(`[系统] 致命错误：${msg}`, 'err'); } catch (_) { }
        Logger.shutdown();
        setTimeout(() => { window.orionLock = false; }, 1500);
    });
})();
