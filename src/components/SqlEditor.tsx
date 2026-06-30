import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql, SQLDialect } from '@codemirror/lang-sql'

// Standard SQL keywords plus the clink / streaming extensions. Lower case here;
// upperCaseKeywords renders them upper case in the editor.
const KEYWORDS = [
  // standard SQL
  'select from where group by having order limit offset distinct',
  'insert into values create table alter drop rename view as with',
  'join left right full inner outer cross on using and or not null',
  'primary key foreign references default case when then else end',
  'union all except intersect asc desc between like in is exists',
  // clink / streaming
  'tumble hop cumulate session watermark materialized analyze',
  'rowtime proctime match_recognize map row multiset interval emit changelog',
].join(' ')

// A clink-flavoured dialect: ANSI base plus the streaming keyword set.
const clinkDialect = SQLDialect.define({ keywords: KEYWORDS })

interface SqlEditorProps {
  value: string
  onChange: (v: string) => void
  // table name -> column names, drives autocomplete
  schema?: Record<string, string[]>
  height?: string
}

export function SqlEditor({ value, onChange, schema, height = '320px' }: SqlEditorProps) {
  const extensions = useMemo(
    () => [sql({ dialect: clinkDialect, schema, upperCaseKeywords: true })],
    [schema],
  )

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <CodeMirror
        value={value}
        onChange={onChange}
        theme="dark"
        height={height}
        extensions={extensions}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
      />
    </div>
  )
}
