import { useState } from 'react';
import { api, type Bootstrap, type Config } from './api';
import type { Notify } from './App';

interface Props {
  boot: Bootstrap;
  refresh: () => Promise<void>;
  notify: Notify;
}

export function PlaybackPage({ boot, refresh, notify }: Props) {
  const [form, setForm] = useState<Config>({ ...boot.config });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Config, value: number | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      await api.patchConfig({
        enabled_limit: Number(form.enabled_limit),
        search_timeout: Number(form.search_timeout),
        search_concurrency: Number(form.search_concurrency),
        play_timeout: Number(form.play_timeout),
        online_first: Boolean(form.online_first),
        auto_best_source: Boolean(form.auto_best_source),
      });
      await refresh();
      notify('设置已保存并即时生效', 'ok');
    } catch (err) {
      notify(err instanceof Error ? err.message : '保存失败', 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>搜索与播放</h1>
        <p className="page-desc">固定预算策略：源数量增加不会延长等待时间</p>
      </div>
      <section className="card">
        <div className="card-title">搜索</div>
        <p className="card-sub">所有启用的源并行搜索，到点即返回已有结果并取消慢源。</p>
        <div className="grid">
          <div>
            <label className="field">总预算（秒，0.5 – 10）</label>
            <input type="number" step="0.1" min="0.5" max="10" value={form.search_timeout}
                   onChange={(e) => set('search_timeout', Number(e.target.value))} />
          </div>
          <div>
            <label className="field">并发上限（1 – 16）</label>
            <input type="number" min="1" max="16" value={form.search_concurrency}
                   onChange={(e) => set('search_concurrency', Number(e.target.value))} />
          </div>
          <div>
            <label className="field">参与搜索源上限（1 – 200）</label>
            <input type="number" min="1" max="200" value={form.enabled_limit}
                   onChange={(e) => set('enabled_limit', Number(e.target.value))} />
          </div>
          <div>
            <label className="field">播放清单超时（秒）</label>
            <input type="number" step="0.5" min="2" max="30" value={form.play_timeout}
                   onChange={(e) => set('play_timeout', Number(e.target.value))} />
          </div>
        </div>
        <div className="divider" />
        <label className="row" style={{ cursor: 'pointer' }}>
          <input
            className="check" type="checkbox" checked={!!form.online_first}
            onChange={(e) => set('online_first', e.target.checked)}
          />
          <span>在线结果排在搜索结果前面</span>
        </label>
        <label className="row mt" style={{ cursor: 'pointer' }}>
          <input
            className="check" type="checkbox" checked={!!form.auto_best_source}
            onChange={(e) => set('auto_best_source', e.target.checked)}
          />
          <span>起播时自动优选最快线路（并发探测 1.5 秒预算）</span>
        </label>
        <div className="row end mt">
          <button className="btn primary" disabled={saving} onClick={() => void save()}>
            {saving ? '保存中…' : '保存设置'}
          </button>
        </div>
      </section>
      <section className="card">
        <div className="card-title">不做的事</div>
        <div className="pill-row mt">
          <span className="pill">无全站测速</span>
          <span className="pill">无常驻预热</span>
          <span className="pill">无占位轮询</span>
          <span className="pill">无后台自愈</span>
          <span className="pill">无健康画像</span>
          <span className="pill">无磁盘缓存</span>
        </div>
      </section>
    </>
  );
}

export function CachePage({ boot, refresh, notify }: Props) {
  const [busy, setBusy] = useState(false);
  async function clear() {
    setBusy(true);
    try {
      const result = await api.clearCache();
      await refresh();
      notify(`已清理 ${result.cleared} 条搜索缓存`, 'ok');
    } catch (err) {
      notify(err instanceof Error ? err.message : '清理失败', 'err');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-head">
        <h1>缓存与记录</h1>
        <p className="page-desc">只有内存缓存，重启即清空，不写磁盘</p>
      </div>
      <div className="grid mb">
        <div className="stat"><div className="value">{boot.titles_cached}</div><div className="label">内存标题条目</div></div>
        <div className="stat"><div className="value">2</div><div className="label">缓存层数</div></div>
        <div className="stat"><div className="value">1</div><div className="label">磁盘配置文件</div></div>
      </div>
      <section className="card">
        <div className="card-title">搜索结果缓存</div>
        <p className="card-sub">
          仅内存、TTL 120 秒、带单飞；播放清单只在单次请求内使用，不落盘。
          播放记录与续播沿用官方影视自身能力，本扩展不额外持久化。
        </p>
        <button className="btn" disabled={busy} onClick={() => void clear()}>
          {busy ? '清理中…' : '清理搜索缓存'}
        </button>
      </section>
    </>
  );
}

export function LogsPage({ notify }: { notify: Notify }) {
  const [lines, setLines] = useState<{ ts: number; msg: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const data = await api.logs();
      setLines(data.logs);
    } catch (err) {
      notify(err instanceof Error ? err.message : '读取失败', 'err');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-head">
        <h1>日志与诊断</h1>
        <p className="page-desc">按需读取，页面不会自动轮询，离开即停止</p>
      </div>
      <section className="card">
        <div className="row mb">
          <button className="btn primary" disabled={busy} onClick={() => void load()}>
            {busy ? '读取中…' : '读取最近日志'}
          </button>
          <span className="small">进程内环形缓冲，最多 200 条，不落盘</span>
        </div>
        {lines === null ? (
          <p className="hint">尚未读取。点击上方按钮获取当前运行日志。</p>
        ) : lines.length === 0 ? (
          <p className="hint">暂无日志记录。</p>
        ) : (
          <div className="log-box">
            {lines.map((line, i) => (
              <div key={`${line.ts}-${i}`}>
                [{new Date(line.ts * 1000).toLocaleTimeString()}] {line.msg}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function AboutPage({ boot }: Props) {
  return (
    <>
      <div className="page-head">
        <h1>关于</h1>
        <p className="page-desc">版本信息与免责声明</p>
      </div>
      <section className="card">
        <div className="card-title">fnos_media_ext</div>
        <div className="pill-row mt">
          <span className="badge brand">v{boot.version}</span>
          <span className="badge">零内置源</span>
          <span className="badge ok">可逆接管</span>
        </div>
        <p className="hint mt">
          零侵入、订阅驱动、带完整 Web 配置页的飞牛影视扩展。停用或卸载后，
          官方影视立即原样恢复。
        </p>
      </section>
      <section className="card">
        <div className="card-title">免责声明</div>
        <p className="small">
          本项目是开源免费的技术研究 / 个人媒体库工具，仅在你自己的 NAS 上运行。
          它本身不提供、不存储、不分发任何影视内容、图片、播放地址，也不内置任何资源站或订阅地址。
          本项目不提供、不推荐、不解答任何资源站点的名称、地址或获取方法；
          接口由使用者自行配置并自行核实合法性。仅供学习交流与个人合法播放自有或已获授权内容使用，
          请勿商用或传播侵权内容，由此产生的法律责任由使用者自行承担。
        </p>
      </section>
    </>
  );
}
