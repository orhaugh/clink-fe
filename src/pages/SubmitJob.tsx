import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, Send } from 'lucide-react'
import { useSubmitJobSo, useSubmitSpec } from '@/hooks/useApi'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/sonner'

export function SubmitJob() {
  const navigate = useNavigate()
  const submitSo = useSubmitJobSo()
  const submitSpec = useSubmitSpec()

  const [file, setFile] = useState<File | null>(null)
  const [soName, setSoName] = useState('')
  const [spec, setSpec] = useState('')
  const [specName, setSpecName] = useState('')

  const onSubmitSo = async () => {
    if (!file) return
    const ack = await submitSo.mutateAsync({ file, name: soName || undefined })
    if (ack.ok && ack.job_id != null) {
      toast.success(`Submitted job #${ack.job_id}`, { description: ack.name })
      navigate(`/jobs/${ack.job_id}`)
    } else {
      toast.error('Submission rejected', { description: ack.error ?? 'unknown error' })
    }
  }

  const specValid = (() => {
    if (!spec.trim()) return false
    try {
      JSON.parse(spec)
      return true
    } catch {
      return false
    }
  })()

  const onSubmitSpec = async () => {
    if (!specValid) return
    const ack = await submitSpec.mutateAsync({ spec, name: specName || undefined })
    if (ack.ok && ack.job_id != null) {
      toast.success(`Submitted job #${ack.job_id}`, { description: ack.name })
      navigate(`/jobs/${ack.job_id}`)
    } else {
      toast.error('Submission rejected', { description: ack.error ?? 'unknown error' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit a job"
        description="Upload a compiled job plugin, or post a JSON job spec referencing built-in operators."
      />

      <Tabs defaultValue="so" className="max-w-2xl">
        <TabsList>
          <TabsTrigger value="so">Plugin upload (.so)</TabsTrigger>
          <TabsTrigger value="spec">JSON spec</TabsTrigger>
        </TabsList>

        <TabsContent value="so">
          <Card>
            <CardHeader>
              <CardTitle>Upload a compiled job</CardTitle>
              <CardDescription>
                A clink job compiled to a shared object (built with CLINK_REGISTER_JOB). The JobManager loads it, runs
                its registration, builds the graph and schedules it. Equivalent to clink_submit_job.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="job-so">Job plugin</Label>
                <label
                  htmlFor="job-so"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/20 px-4 py-8 text-center transition-colors hover:border-primary/60 hover:bg-muted/40"
                >
                  <FileUp className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm">
                    {file ? <span className="font-mono text-foreground">{file.name}</span> : 'Choose a .so file or drop it here'}
                  </span>
                  {file && <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KiB</span>}
                </label>
                <input
                  id="job-so"
                  type="file"
                  accept=".so,.dylib,application/octet-stream"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="so-name">Display name (optional)</Label>
                <Input
                  id="so-name"
                  placeholder="defaults to the file name"
                  value={soName}
                  onChange={(e) => setSoName(e.target.value)}
                />
              </div>
              <Button onClick={onSubmitSo} disabled={!file || submitSo.isPending}>
                <Send className="h-4 w-4" />
                {submitSo.isPending ? 'Submitting...' : 'Submit job'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spec">
          <Card>
            <CardHeader>
              <CardTitle>Post a JSON job spec</CardTitle>
              <CardDescription>
                A JobGraphSpec referencing built-in operator factories only (no plugin .so). This is the path
                clink_submit_sql uses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="spec-name">Display name (optional)</Label>
                <Input
                  id="spec-name"
                  placeholder="defaults to sql_job"
                  value={specName}
                  onChange={(e) => setSpecName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spec-body">Spec JSON</Label>
                <textarea
                  id="spec-body"
                  spellCheck={false}
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  placeholder='{ "operators": [ ... ], "edges": [ ... ] }'
                  className="h-72 w-full resize-y rounded-md border border-input bg-transparent p-3 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {spec.trim() && !specValid && <p className="text-xs text-danger">Not valid JSON yet.</p>}
              </div>
              <Button onClick={onSubmitSpec} disabled={!specValid || submitSpec.isPending}>
                <Send className="h-4 w-4" />
                {submitSpec.isPending ? 'Submitting...' : 'Submit spec'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
