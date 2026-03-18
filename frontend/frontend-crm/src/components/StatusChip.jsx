export default function StatusChip({ status }) {
  const labels = { complet: 'Complet', incomplet: 'Incomplet', alerte: 'Alerte' }
  const dotColor = status === 'complet' ? 'green' : status === 'incomplet' ? 'orange' : 'red'
  return (
    <span className={`status-chip ${status}`}>
      <span className={`status-dot ${dotColor}`} />
      {labels[status] || status}
    </span>
  )
}
