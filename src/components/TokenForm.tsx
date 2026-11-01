import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setAuthToken } from '@/lib/auth'
import { useAuthToken } from '@/hooks/useAuthToken'

// Shown where a request came back 401: the Coordinator was started with
// CLINK_AUTH_TOKEN. The token is kept for this browser tab only and sent on
// every request from then on, the live event stream included.
export function TokenForm() {
  const qc = useQueryClient()
  const current = useAuthToken()
  const [token, setToken] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    setAuthToken(token)
    void qc.invalidateQueries()
  }
  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-3 py-12 text-center">
      <KeyRound className="h-6 w-6 text-primary" />
      <div className="text-sm font-medium">
        {current ? 'That token was refused' : 'This cluster asks for a token'}
      </div>
      <div className="max-w-md text-xs text-muted-foreground">
        The Coordinator was started with CLINK_AUTH_TOKEN. The token is kept for this browser tab
        only and sent on every request.
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="clink-auth-token" className="sr-only">
          Token
        </Label>
        <Input
          id="clink-auth-token"
          type="password"
          autoComplete="off"
          className="h-8 w-64 font-mono text-xs"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={!token}>
          Use token
        </Button>
      </div>
    </form>
  )
}
