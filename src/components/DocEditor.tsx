'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useEffect } from 'react'
import clsx from 'clsx'

// 공문 번호 레벨
const LEVELS = ['1.','가.','1)','가)','(1)','(가)']
const KO_CHARS = ['가','나','다','라','마','바','사','아','자','차','카','타','파','하']

function getNextBullet(text: string): string {
  const t = text.trimStart()
  // 숫자. 레벨
  const numDot = t.match(/^(\d+)\.\s/)
  if (numDot) return `${parseInt(numDot[1]) + 1}. `
  // 한글. 레벨
  const koDot = t.match(/^([가-하])\.\s/)
  if (koDot) {
    const idx = KO_CHARS.indexOf(koDot[1])
    if (idx >= 0 && idx < KO_CHARS.length - 1) return `${KO_CHARS[idx+1]}. `
  }
  // 숫자) 레벨
  const numPar = t.match(/^(\d+)\)\s/)
  if (numPar) return `${parseInt(numPar[1]) + 1}) `
  // 한글) 레벨
  const koPar = t.match(/^([가-하])\)\s/)
  if (koPar) {
    const idx = KO_CHARS.indexOf(koPar[1])
    if (idx >= 0 && idx < KO_CHARS.length - 1) return `${KO_CHARS[idx+1]}) `
  }
  // (숫자) 레벨
  const numBr = t.match(/^\((\d+)\)\s/)
  if (numBr) return `(${parseInt(numBr[1]) + 1}) `
  // (한글) 레벨
  const koBr = t.match(/^\(([가-하])\)\s/)
  if (koBr) {
    const idx = KO_CHARS.indexOf(koBr[1])
    if (idx >= 0 && idx < KO_CHARS.length - 1) return `(${KO_CHARS[idx+1]}) `
  }
  return ''
}

// 기호 목록
const SYMBOLS = [
  { label: '일반', items: ['○','●','△','▲','□','■','◇','◆','☆','★','→','←','↑','↓','↔','◎','※','§','¶','†'] },
  { label: '단위', items: ['㎡','㎢','㎞','㎝','㎜','㎏','㎎','㏄','℃','℉','°','\'','\"','%','‰','㎾','㎿'] },
  { label: '숫자', items: ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'] },
  { label: '화살', items: ['➀','➁','➂','➃','➄','➅','➆','➇','➈','➉','⇒','⇐','⇑','⇓','⇔','⟹','⟸','↗','↘','↙'] },
]

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

export default function DocEditor({ value, onChange, placeholder = '본문을 입력하세요', minHeight = 300 }: Props) {
  const [showSymbol, setShowSymbol] = useState(false)
  const [symbolTab,  setSymbolTab]  = useState(0)
  const [showTable,  setShowTable]  = useState(false)
  const [tableRows,  setTableRows]  = useState(3)
  const [tableCols,  setTableCols]  = useState(3)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key !== 'Enter') return false
        const { state } = view
        const { $from } = state.selection
        const lineText = $from.nodeBefore?.textContent ?? ''
        const next = getNextBullet(lineText)
        if (next) {
          // 다음 번호 자동 삽입
          setTimeout(() => {
            editor?.commands.insertContent(next)
          }, 0)
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value])

  if (!editor) return null

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run()
    setShowTable(false)
  }

  const insertSymbol = (sym: string) => {
    editor.chain().focus().insertContent(sym).run()
  }

  const addEndMark = () => {
    editor.chain().focus().command(({ tr, dispatch, state }) => {
      const end = state.doc.content.size
      if (dispatch) {
        tr.insertText('  끝.', end - 1)
        dispatch(tr)
      }
      return true
    }).run()
  }

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden">
      {/* 툴바 */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200 flex-wrap">
        {/* 텍스트 서식 */}
        <button onClick={() => editor.chain().focus().toggleBold().run()}
          className={clsx('px-2 py-1 rounded text-sm font-bold transition-colors', editor.isActive('bold') ? 'bg-primary-100 text-primary-800' : 'hover:bg-gray-200 text-gray-600')}>
          B
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}
          className={clsx('px-2 py-1 rounded text-sm italic transition-colors', editor.isActive('italic') ? 'bg-primary-100 text-primary-800' : 'hover:bg-gray-200 text-gray-600')}>
          I
        </button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={clsx('px-2 py-1 rounded text-sm underline transition-colors', editor.isActive('underline') ? 'bg-primary-100 text-primary-800' : 'hover:bg-gray-200 text-gray-600')}>
          U
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1"/>

        {/* 정렬 */}
        {[
          { align: 'left',    icon: '≡' },
          { align: 'center',  icon: '≡' },
          { align: 'right',   icon: '≡' },
        ].map(({ align, icon }) => (
          <button key={align} onClick={() => editor.chain().focus().setTextAlign(align).run()}
            className={clsx('px-2 py-1 rounded text-xs transition-colors', editor.isActive({ textAlign: align }) ? 'bg-primary-100 text-primary-800' : 'hover:bg-gray-200 text-gray-600')}>
            {align === 'left' ? '◧' : align === 'center' ? '◫' : '◨'}
          </button>
        ))}

        <div className="w-px h-5 bg-gray-300 mx-1"/>

        {/* 번호 체계 버튼 */}
        {LEVELS.map(lv => (
          <button key={lv} onClick={() => editor.chain().focus().insertContent(lv + ' ').run()}
            className="px-1.5 py-1 rounded text-xs text-gray-600 hover:bg-gray-200 font-mono transition-colors">
            {lv}
          </button>
        ))}

        <div className="w-px h-5 bg-gray-300 mx-1"/>

        {/* 표 */}
        <div className="relative">
          <button onClick={() => { setShowTable(v=>!v); setShowSymbol(false) }}
            className={clsx('px-2 py-1 rounded text-xs transition-colors', showTable ? 'bg-primary-100 text-primary-800' : 'hover:bg-gray-200 text-gray-600')}>
            ⊞ 표
          </button>
          {showTable && (
            <div className="absolute top-8 left-0 z-20 bg-white border border-gray-200 rounded-xl p-3 shadow-lg w-44">
              <p className="text-xs font-medium text-gray-600 mb-2">표 크기 설정</p>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-400">행(가로)</label>
                  <input type="number" min={1} max={20} value={tableRows}
                    onChange={e => setTableRows(+e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"/>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400">열(세로)</label>
                  <input type="number" min={1} max={10} value={tableCols}
                    onChange={e => setTableCols(+e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"/>
                </div>
              </div>
              <button onClick={insertTable}
                className="w-full py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-800">
                표 삽입
              </button>
              {editor.isActive('table') && (
                <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                  <button onClick={() => editor.chain().focus().addRowAfter().run()}
                    className="w-full py-1 text-xs text-gray-600 hover:bg-gray-50 rounded">+ 행 추가</button>
                  <button onClick={() => editor.chain().focus().addColumnAfter().run()}
                    className="w-full py-1 text-xs text-gray-600 hover:bg-gray-50 rounded">+ 열 추가</button>
                  <button onClick={() => editor.chain().focus().deleteRow().run()}
                    className="w-full py-1 text-xs text-red-400 hover:bg-red-50 rounded">- 행 삭제</button>
                  <button onClick={() => editor.chain().focus().deleteColumn().run()}
                    className="w-full py-1 text-xs text-red-400 hover:bg-red-50 rounded">- 열 삭제</button>
                  <button onClick={() => editor.chain().focus().deleteTable().run()}
                    className="w-full py-1 text-xs text-red-500 hover:bg-red-50 rounded font-medium">표 삭제</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 기호 */}
        <div className="relative">
          <button onClick={() => { setShowSymbol(v=>!v); setShowTable(false) }}
            className={clsx('px-2 py-1 rounded text-xs transition-colors', showSymbol ? 'bg-primary-100 text-primary-800' : 'hover:bg-gray-200 text-gray-600')}>
            Ω 기호
          </button>
          {showSymbol && (
            <div className="absolute top-8 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-64">
              <div className="flex border-b border-gray-100">
                {SYMBOLS.map((s, i) => (
                  <button key={i} onClick={() => setSymbolTab(i)}
                    className={clsx('flex-1 py-1.5 text-xs font-medium transition-colors',
                      symbolTab === i ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-500' : 'text-gray-500 hover:bg-gray-50')}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-10 gap-0.5 p-2">
                {SYMBOLS[symbolTab].items.map(sym => (
                  <button key={sym} onClick={() => insertSymbol(sym)}
                    className="w-6 h-6 flex items-center justify-center text-sm hover:bg-gray-100 rounded transition-colors">
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 끝. 추가 */}
        <button onClick={addEndMark}
          className="px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-200 transition-colors ml-auto">
          끝. 추가
        </button>
      </div>

      {/* 에디터 본문 */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none"
        style={{ minHeight, padding: '12px 16px', fontFamily: 'Nanum Myeongjo, serif', fontSize: '11pt', lineHeight: '1.8' }}
      />

      {/* 표 스타일 */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&display=swap');
        .ProseMirror { outline: none; }
        .ProseMirror p { margin: 0 0 4px; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #aaa; float: left; pointer-events: none; height: 0;
        }
        .ProseMirror table {
          border-collapse: collapse; width: 100%; margin: 8px 0;
          font-size: 10pt;
        }
        .ProseMirror table td, .ProseMirror table th {
          border: 1px solid #555; padding: 4px 8px;
          min-width: 40px; position: relative;
        }
        .ProseMirror table th {
          background: #f5f5f5; font-weight: 700; text-align: center;
        }
        .ProseMirror table .selectedCell::after {
          background: rgba(83,74,183,0.15);
          content: ''; left: 0; right: 0; top: 0; bottom: 0;
          pointer-events: none; position: absolute; z-index: 2;
        }
        .ProseMirror .column-resize-handle {
          background: #534AB7; bottom: -2px; position: absolute;
          right: -2px; top: 0; width: 4px; pointer-events: none;
        }
        .ProseMirror strong { font-weight: 700; }
        .ProseMirror em { font-style: italic; }
        .ProseMirror u { text-decoration: underline; }
      `}</style>
    </div>
  )
}
