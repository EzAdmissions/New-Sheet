import { useState, useRef, useEffect, useCallback } from 'react';
import useStore from './store';
import { useTheme, getSpeechColor } from './theme';
import { getUiChrome, chromeButton } from './uiChrome';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function encode(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function decode(str) {
  return JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
}

function waitForICE(pc) {
  return new Promise(resolve => {
    if (pc.iceGatheringState === 'complete') { resolve(pc.localDescription); return; }
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve(pc.localDescription);
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve(pc.localDescription);
    }, 10000);
  });
}

function ReadOnlyGrid({ sheet, settings, theme, ui }) {
  if (!sheet) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted, fontSize: 13 }}>No sheet data</div>;
  const { speeches, grid } = sheet;
  const ROWS = 200;
  let lastRow = 0;
  for (const sp of speeches) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[sp]?.[r]?.trim()) { lastRow = Math.max(lastRow, r); break; }
    }
  }
  const displayRows = Math.min(ROWS, lastRow + 8);
  const rh = settings.rowHeight ?? 22;
  const fs = settings.fontSize ?? 12;
  const pad = 8;

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 5, background: ui.gridHeaderBg ?? theme.bgSecondary, borderBottom: `2px solid ${ui.border ?? theme.border}` }}>
        {speeches.map((sp, ci) => (
          <div key={sp} style={{
            flex: 1, padding: `5px ${pad}px`, fontWeight: 700, fontSize: 11,
            textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center',
            color: getSpeechColor(sp, theme, settings),
            borderRight: ci < speeches.length - 1 ? `1px solid ${ui.border ?? theme.border}` : 'none',
          }}>{sp}</div>
        ))}
      </div>
      <div>
        {Array.from({ length: displayRows }, (_, rowIdx) => (
          <div key={rowIdx} style={{ display: 'flex', borderBottom: `1px solid ${ui.borderSubtle ?? theme.borderSubtle}` }}>
            {speeches.map((sp, ci) => (
              <div key={sp} style={{
                flex: 1, minHeight: rh, padding: `2px ${pad}px`,
                fontSize: fs, fontFamily: settings.fontFamily ?? 'Arial, sans-serif',
                color: getSpeechColor(sp, theme, settings),
                borderRight: ci < speeches.length - 1 ? `1px solid ${ui.borderSubtle ?? theme.borderSubtle}` : 'none',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {grid[sp]?.[rowIdx] ?? ''}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeamViewer({ onClose }) {
  const settings    = useStore(s => s.settings);
  const activeRound = useStore(s => s.rounds.find(r => r.id === s.activeRoundId));
  const theme = useTheme(settings.theme);
  const ui    = getUiChrome(settings, theme);

  // Always-current ref so the broadcast closure reads the latest store value
  const activeRoundRef = useRef(activeRound);
  activeRoundRef.current = activeRound;

  const [mode, setMode]                     = useState(null);        // 'host' | 'connect'
  const [step, setStep]                     = useState('choose');    // 'choose'|'inputCode'|'generating'|'waitAnswer'|'waitConnect'|'connected'
  const [myCode, setMyCode]                 = useState('');
  const [inputCode, setInputCode]           = useState('');
  const [partnerRound, setPartnerRound]     = useState(null);
  const [partnerActiveId, setPartnerActiveId] = useState(null);
  const [viewSheetId, setViewSheetId]       = useState(null);
  const [error, setError]                   = useState('');
  const [copied, setCopied]                 = useState(false);

  const pcRef        = useRef(null);
  const channelRef   = useRef(null);
  const broadcastRef = useRef(null);

  const cleanup = useCallback(() => {
    if (broadcastRef.current) { clearInterval(broadcastRef.current); broadcastRef.current = null; }
    try { channelRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    channelRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const setupChannel = useCallback((ch) => {
    channelRef.current = ch;
    ch.onopen  = () => setStep('connected');
    ch.onclose = () => setStep(s => s === 'connected' ? 'disconnected' : s);
    ch.onerror = () => setError('Connection lost.');
    ch.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'round') {
          setPartnerRound(data.round);
          setPartnerActiveId(data.activeSheetId);
          setViewSheetId(id => id ?? data.activeSheetId ?? data.round?.sheets?.[0]?.id ?? null);
        }
      } catch {}
    };
  }, []);

  // Host: flush FlowGrid's live buffer then broadcast at 300ms
  useEffect(() => {
    if (step !== 'connected' || mode !== 'host') return;
    const send = () => {
      // Ask FlowGrid to push its in-memory buffer to the store right now
      window.dispatchEvent(new CustomEvent('jayflow-flush-now'));
      const round = activeRoundRef.current;
      const ch = channelRef.current;
      if (ch?.readyState === 'open' && round) {
        try { ch.send(JSON.stringify({ type: 'round', round, activeSheetId: round.activeSheetId })); } catch {}
      }
    };
    send();
    broadcastRef.current = setInterval(send, 300);
    return () => { if (broadcastRef.current) { clearInterval(broadcastRef.current); broadcastRef.current = null; } };
  }, [step, mode]);

  const handleHost = useCallback(async () => {
    setMode('host');
    setStep('generating');
    setError('');
    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      setupChannel(pc.createDataChannel('flow'));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const desc = await waitForICE(pc);
      setMyCode(encode({ sdp: desc.sdp, type: desc.type }));
      setStep('waitAnswer');
    } catch (e) {
      setError('Failed to create session: ' + e.message);
      setStep('choose');
    }
  }, [setupChannel]);

  const handleConnect = useCallback(async () => {
    setStep('generating');
    setError('');
    try {
      const offer = decode(inputCode);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      pc.ondatachannel = (e) => setupChannel(e.channel);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const desc = await waitForICE(pc);
      setMyCode(encode({ sdp: desc.sdp, type: desc.type }));
      setStep('waitConnect');
    } catch (e) {
      setError('Invalid session code. Make sure you pasted the full code.');
      setStep('inputCode');
    }
  }, [inputCode, setupChannel]);

  const handleCompleteHost = useCallback(async () => {
    setError('');
    try {
      const answer = decode(inputCode);
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      setError('Invalid answer code.');
    }
  }, [inputCode]);

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(myCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [myCode]);

  const reset = useCallback(() => {
    cleanup();
    setMode(null); setStep('choose'); setMyCode(''); setInputCode('');
    setPartnerRound(null); setPartnerActiveId(null); setViewSheetId(null); setError('');
  }, [cleanup]);

  const partnerSheets = (partnerRound?.sheets ?? []).filter(s => s.type !== 'cx');
  const viewSheet = partnerSheets.find(s => s.id === viewSheetId) ?? partnerSheets[0] ?? null;

  const wrap = { position: 'fixed', inset: 0, zIndex: 1000, background: ui.appBg ?? theme.bg, display: 'flex', flexDirection: 'column', fontFamily: ui.fontFamily, color: theme.text };
  const hdr  = { display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', height: ui.toolbarHeight ?? 38, background: ui.toolbarBg, borderBottom: `1px solid ${ui.border}`, flexShrink: 0 };
  const codeBox = { width: '100%', padding: 10, fontFamily: 'monospace', fontSize: 10, background: ui.inputBg ?? theme.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: ui.radius, color: theme.text, resize: 'none', boxSizing: 'border-box', height: 88, outline: 'none' };

  // ── Connected: viewer sees partner's flow ──
  if (step === 'connected' && mode === 'connect') {
    return (
      <div style={wrap}>
        <div style={hdr}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Partner's Flow</span>
          <span style={{ fontSize: 11, color: theme.textMuted }}>live</span>
          <div style={{ flex: 1 }} />
          <button onClick={reset} style={chromeButton(theme, ui, { fontSize: 12, padding: '4px 10px' })}>Disconnect</button>
          <button onClick={onClose} style={{ ...chromeButton(theme, ui, { fontSize: 12, padding: '4px 10px' }), fontWeight: 600 }}>Back to My Flow</button>
        </div>

        {/* Sheet tabs */}
        <div style={{ display: 'flex', alignItems: 'center', background: ui.toolbarBg, borderBottom: `1px solid ${ui.border}`, overflowX: 'auto', height: ui.tabHeight ?? 32, flexShrink: 0 }}>
          {partnerSheets.map(sh => {
            const isActive = sh.id === viewSheetId;
            const isPartnerHere = sh.id === partnerActiveId;
            return (
              <div key={sh.id} onClick={() => setViewSheetId(sh.id)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px',
                height: '100%', cursor: 'pointer', flexShrink: 0,
                borderRight: `1px solid ${ui.borderSubtle}`,
                borderBottom: `2px solid ${isActive ? theme.text : 'transparent'}`,
                background: isActive ? ui.tabActiveBg : ui.tabInactiveBg,
                whiteSpace: 'nowrap', userSelect: 'none',
                fontSize: 12, color: isActive ? theme.text : theme.textMuted,
              }}>
                {sh.name}
                {isPartnerHere && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} title="Partner is here" />}
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: ui.gridBg ?? theme.bg }}>
          <ReadOnlyGrid sheet={viewSheet} settings={settings} theme={theme} ui={ui} />
        </div>
      </div>
    );
  }

  // ── Connected: host is broadcasting ──
  if (step === 'connected' && mode === 'host') {
    return (
      <div style={wrap}>
        <div style={hdr}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Team Viewer - Hosting</span>
          <span style={{ fontSize: 11, color: theme.textMuted }}>partner connected - broadcasting your flow</span>
          <div style={{ flex: 1 }} />
          <button onClick={reset} style={chromeButton(theme, ui, { fontSize: 12, padding: '4px 10px' })}>Stop</button>
          <button onClick={onClose} style={{ ...chromeButton(theme, ui, { fontSize: 12, padding: '4px 10px' }), fontWeight: 600 }}>Back to My Flow</button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600, color: theme.text }}>Your flow is live</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Your partner can view your flow in real time. Go back to your flow - it keeps broadcasting.</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Setup screens ──
  return (
    <div style={wrap}>
      <div style={hdr}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Team Viewer</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={chromeButton(theme, ui, { fontSize: 12, padding: '4px 10px' })}>Close</button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>

          {error && (
            <div style={{ marginBottom: 14, padding: '8px 12px', background: theme.theme === 'dark' ? '#450a0a' : '#fef2f2', border: '1px solid #fca5a5', borderRadius: ui.radius, color: '#dc2626', fontSize: 12 }}>
              {error}
            </div>
          )}

          {/* Step: choose mode */}
          {step === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Connect with your partner</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>
                Works across any network - school Wi-Fi, hotspot, or home. You exchange a short code once, then it's live.
              </div>
              <button onClick={handleHost} style={{ ...chromeButton(theme, ui, { padding: '12px 0', fontSize: 14 }), width: '100%', fontWeight: 600 }}>
                Share My Flow (Host)
              </button>
              <button onClick={() => { setMode('connect'); setStep('inputCode'); }} style={{ ...chromeButton(theme, ui, { padding: '12px 0', fontSize: 14 }), width: '100%' }}>
                View Partner's Flow (Connect)
              </button>
            </div>
          )}

          {/* Step: paste partner's code */}
          {step === 'inputCode' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Paste your partner's session code</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>Your partner clicks "Host" and shares a code with you.</div>
              <textarea
                style={{ ...codeBox, height: 100 }}
                placeholder="Paste full session code here..."
                value={inputCode}
                onChange={e => setInputCode(e.target.value)}
                spellCheck={false}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setStep('choose'); setMode(null); setInputCode(''); }} style={chromeButton(theme, ui, { padding: '7px 14px', fontSize: 13 })}>
                  Back
                </button>
                <button
                  onClick={handleConnect}
                  disabled={!inputCode.trim()}
                  style={{ ...chromeButton(theme, ui, { padding: '7px 14px', fontSize: 13 }), flex: 1, fontWeight: 600, opacity: inputCode.trim() ? 1 : 0.4 }}
                >
                  Generate Answer Code
                </button>
              </div>
            </div>
          )}

          {/* Step: generating (ICE gathering) */}
          {step === 'generating' && (
            <div style={{ textAlign: 'center', color: theme.textMuted, padding: 32 }}>
              <div style={{ fontWeight: 600, color: theme.text }}>Generating connection code...</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>This takes a few seconds</div>
            </div>
          )}

          {/* Step: host shows session code, waits for answer */}
          {step === 'waitAnswer' && mode === 'host' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Step 1 - Send this code to your partner</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>Share it via Discord, iMessage, etc. They paste it in "Connect" mode.</div>
              <textarea style={codeBox} value={myCode} readOnly />
              <button onClick={copyCode} style={{ ...chromeButton(theme, ui, { padding: '7px 14px', fontSize: 13 }), fontWeight: 600 }}>
                {copied ? 'Copied!' : 'Copy Code'}
              </button>

              <div style={{ borderTop: `1px solid ${ui.borderSubtle}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Step 2 - Paste partner's answer code</div>
                <div style={{ fontSize: 12, color: theme.textMuted }}>After they paste your code, they'll generate an answer code to send back to you.</div>
                <textarea
                  style={{ ...codeBox, height: 80 }}
                  placeholder="Paste answer code from partner..."
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value)}
                  spellCheck={false}
                />
                <button
                  onClick={handleCompleteHost}
                  disabled={!inputCode.trim()}
                  style={{ ...chromeButton(theme, ui, { padding: '7px 14px', fontSize: 13 }), fontWeight: 600, opacity: inputCode.trim() ? 1 : 0.4 }}
                >
                  Connect
                </button>
              </div>
            </div>
          )}

          {/* Step: viewer shows answer code, waits */}
          {step === 'waitConnect' && mode === 'connect' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Step 2 - Send this answer code to your partner</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>They paste it in their "Host" panel to complete the connection.</div>
              <textarea style={codeBox} value={myCode} readOnly />
              <button onClick={copyCode} style={{ ...chromeButton(theme, ui, { padding: '7px 14px', fontSize: 13 }), fontWeight: 600 }}>
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
              <div style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center', marginTop: 4 }}>
                Waiting for partner to finalize...
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
