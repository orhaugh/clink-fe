import { Link } from 'react-router-dom'

// A job's number, linked to its page, with the name it was submitted with
// beside it when the coordinator reports one.
export function JobLink({ id, name }: { id: number; name?: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <Link to={`/jobs/${id}`} className="font-mono text-primary hover:underline">
        #{id}
      </Link>
      {name ? <span className="text-sm">{name}</span> : null}
    </span>
  )
}
