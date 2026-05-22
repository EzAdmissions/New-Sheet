import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useTheme } from './theme';
import { getUiChrome } from './uiChrome';
import useStore from './store';

const DialogContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useDialog() {
  return useContext(DialogContext);
}

export function DialogProvider({ children }) {
  const settings = useStore(s => s.settings);
  const theme = useTheme(settings.theme);
  const ui = getUiChrome(settings, theme);

  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const showConfirm = useCallback((message, { confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setDialog({ type: 'confirm', message, confirmLabel, cancelLabel, danger });
    });
  }, []);

  const showAlert = useCallback((message, { label = 'OK' } = {}) => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setDialog({ type: 'alert', message, label });
    });
  }, []);

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setDialog(null);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    setDialog(null);
  };

  return (
    <DialogContext.Provider value={{ showConfirm, showAlert }}>
      {children}
      {dialog && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={dialog.type === 'confirm' ? handleCancel : handleConfirm}
        >
          <div
            style={{
              background: ui.panelBg,
              backgroundImage: ui.panelBackgroundImage ?? ui.appBackgroundImage,
              backgroundSize: ui.appBackgroundSize,
              border: `1px solid ${ui.border}`,
              borderRadius: ui.cardRadius,
              padding: '24px 28px',
              maxWidth: 380,
              width: '90%',
              boxShadow: ui.modalShadow,
              fontFamily: ui.fontFamily,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              fontSize: 14,
              color: theme.text,
              lineHeight: 1.55,
              marginBottom: 20,
              whiteSpace: 'pre-wrap',
            }}>
              {dialog.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {dialog.type === 'confirm' && (
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '6px 16px',
                    background: theme.bgTertiary,
                    border: `1px solid ${ui.border}`,
                    borderRadius: ui.radius,
                    color: theme.textMuted,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {dialog.cancelLabel}
                </button>
              )}
              <button
                onClick={handleConfirm}
                autoFocus
                style={{
                  padding: '6px 16px',
                  background: dialog.danger ? '#b91c1c' : theme.aff,
                  border: 'none',
                  borderRadius: ui.radius,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {dialog.type === 'confirm' ? dialog.confirmLabel : dialog.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
