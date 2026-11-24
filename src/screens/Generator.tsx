import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import { Icon } from '../icons';
import { ColoredPassword, Header, Segmented, Sheet, Toggle } from '../ui';
import { generate, generatedBits } from '../generator';
import { crackTime, COLORS, LABELS } from '../strength';
import { copy } from '../platform';
import { toast } from '../toast';
import type { GenOptions } from '../types';
import { ago } from '../utils';

/** The generator itself: used on its own screen and inside the item editor. */
export function GeneratorPanel({ onUse }: { onUse?: (value: string) => void }) {
  const { data, update } = useStore();
  const o = data.settings.gen;
  const [value, setValue] = useState(() => generate(o));
  const set = (patch: Partial<GenOptions>) => update((d) => ({ ...d, settings: { ...d.settings, gen: { ...d.settings.gen, ...patch } } }));
  const regen = useCallback(() => setValue(generate(o)), [o]);
  useEffect(regen, [regen]);

  const bits = generatedBits(o);
  const level = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  const remember = (v: string) => update((d) => ({ ...d, genHistory: [{ value: v, at: Date.now() }, ...d.genHistory.filter((h) => h.value !== v)].slice(0, 20) }));

  const doCopy = async () => {
    await copy(value, data.settings.clipboardClearSec);
    remember(value);
    toast('Copied');
  };
  const typeCount = (['upper', 'lower', 'digits', 'symbols'] as const).filter((k) => o[k]).length;

  return (
    <div className="stack">
      <Segmented
        label="Kind of password"
        value={o.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'random', label: 'Random' },
          { value: 'passphrase', label: 'Passphrase' },
          { value: 'pin', label: 'PIN' },
        ]}
      />
      <div className="card gen-card">
        <p className="gen-value" aria-live="polite">
          <ColoredPassword value={value} />
        </p>
        <div className="strength">
          <div className="strength-bars" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ background: i < Math.max(1, level) ? COLORS[level] : undefined }} />
            ))}
          </div>
          <span className="small" style={{ color: COLORS[level], fontWeight: 600 }}>
            {LABELS[level]} · {Math.round(bits)} bits · {crackTime(bits)} to crack
          </span>
        </div>
        <div className="grid2">
          <button className="btn secondary" onClick={regen}>
            <Icon name="dice" size={18} /> New
          </button>
          {onUse ? (
            <button
              className="btn primary"
              onClick={() => {
                remember(value);
                onUse(value);
              }}
            >
              <Icon name="check" size={18} /> Use this
            </button>
          ) : (
            <button className="btn primary" onClick={doCopy}>
              <Icon name="copy" size={18} /> Copy
            </button>
          )}
        </div>
      </div>

      <div className="card list">
        {o.mode === 'random' && (
          <>
            <Slider label="Length" value={o.length} min={8} max={64} onChange={(length) => set({ length })} />
            <Toggle label="Uppercase (A–Z)" checked={o.upper} disabled={o.upper && typeCount === 1} onChange={(upper) => set({ upper })} />
            <Toggle label="Lowercase (a–z)" checked={o.lower} disabled={o.lower && typeCount === 1} onChange={(lower) => set({ lower })} />
            <Toggle label="Numbers (0–9)" checked={o.digits} disabled={o.digits && typeCount === 1} onChange={(digits) => set({ digits })} />
            <Toggle label="Symbols (!@#$)" checked={o.symbols} disabled={o.symbols && typeCount === 1} onChange={(symbols) => set({ symbols })} />
            <Toggle label="Avoid look-alikes" sub="Leaves out l, 1, I, O, 0" checked={o.avoidAmbiguous} onChange={(avoidAmbiguous) => set({ avoidAmbiguous })} />
          </>
        )}
        {o.mode === 'passphrase' && (
          <>
            <Slider label="Words" value={o.words} min={3} max={10} onChange={(words) => set({ words })} />
            <div className="row">
              <span className="row-main">
                <span className="row-title">Separator</span>
              </span>
              <div className="chips tight">
                {['-', '.', '_', ' ', ''].map((s) => (
                  <button key={s || 'none'} className={`chip ${o.separator === s ? 'on' : ''}`} onClick={() => set({ separator: s })} aria-pressed={o.separator === s}>
                    {s === ' ' ? 'space' : s === '' ? 'none' : s}
                  </button>
                ))}
              </div>
            </div>
            <Toggle label="Capitalise words" checked={o.capitalize} onChange={(capitalize) => set({ capitalize })} />
            <Toggle label="Add a number" checked={o.includeNumber} onChange={(includeNumber) => set({ includeNumber })} />
          </>
        )}
        {o.mode === 'pin' && <Slider label="Digits" value={o.pinLength} min={4} max={12} onChange={(pinLength) => set({ pinLength })} />}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="row slider-row">
      <span className="row-between">
        <span className="row-title">{label}</span>
        <span className="num accent-text">{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Generator() {
  const { data, update } = useStore();
  const [history, setHistory] = useState(false);
  return (
    <div className="page narrow">
      <Header
        big
        title="Generator"
        right={
          data.genHistory.length > 0 && (
            <button className="btn-icon" onClick={() => setHistory(true)} aria-label="Generator history">
              <Icon name="history" />
            </button>
          )
        }
      />
      <GeneratorPanel />
      {history && (
        <Sheet title="Recently generated" onClose={() => setHistory(false)}>
          <p className="muted small" style={{ marginTop: 0 }}>
            The last 20 passwords you copied or used. Kept encrypted in your vault.
          </p>
          <div className="card list">
            {data.genHistory.map((h) => (
              <div className="field-row" key={h.at + h.value}>
                <div className="row-main">
                  <span className="f-value mono" style={{ wordBreak: 'break-all' }}>
                    <ColoredPassword value={h.value} />
                  </span>
                  <span className="f-label">{ago(h.at)}</span>
                </div>
                <button className="btn-icon soft accent" aria-label="Copy" onClick={() => copy(h.value, data.settings.clipboardClearSec).then(() => toast('Copied'))}>
                  <Icon name="copy" size={18} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="btn danger-ghost"
            onClick={() => {
              update((d) => ({ ...d, genHistory: [] }));
              setHistory(false);
            }}
          >
            Clear history
          </button>
        </Sheet>
      )}
    </div>
  );
}
