import { useToasts } from './hooks/useToasts'

export function ToastContainer() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}`}
          onClick={() => dismiss(t.id)}
        >
          <div className="toast-message">{t.message}</div>
          {t.detail && <div className="toast-detail">{t.detail}</div>}
        </div>
      ))}
    </div>
  )
}
