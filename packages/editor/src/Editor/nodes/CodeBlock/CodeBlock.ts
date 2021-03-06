// Copyright 2022 LiYechao
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { nanoid } from 'nanoid'
import { InputRule, textblockTypeInputRule } from 'prosemirror-inputrules'
import { NodeType, Slice } from 'prosemirror-model'
import { Plugin, Transaction } from 'prosemirror-state'
import { ReplaceStep } from 'prosemirror-transform'
import { Node, NodeViewCreator, StrictNodeSpec, StrictProsemirrorNode } from '../../lib/Node'
import CodeBlockNodeView, { MonacoEditorTransactionMetaKey } from './CodeBlockNodeView'

type MonacoInstance = import('./MonacoEditor').MonacoInstance

export interface CodeBlockAttrs {
  editorId: string | null
  language: string | null
}

export default class CodeBlock implements Node<CodeBlockAttrs> {
  constructor(public options: { clientID?: string | number } = {}) {}

  private _clientID?: number
  get clientID(): string | number {
    return this.options.clientID ?? (this._clientID ??= Math.floor(Math.random() * 100000))
  }

  get name(): string {
    return 'code_block'
  }

  get schema(): StrictNodeSpec<CodeBlockAttrs> {
    return {
      attrs: { editorId: { default: null }, language: { default: null } },
      content: 'text*',
      marks: '',
      group: 'block',
      code: true,
      defining: true,
      isolating: true,
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs: node => {
            if (node instanceof HTMLElement) {
              return {
                editorId: null,
                language: node.dataset['language'] || null,
              }
            }
            return undefined
          },
        },
      ],
      toDOM: node => {
        return ['pre', { 'data-language': node.attrs.language }, ['code', 0]]
      },
    }
  }

  private isCodeBlock(doc: StrictProsemirrorNode<any>, from: number, to: number) {
    let res: { node: StrictProsemirrorNode<CodeBlockAttrs>; pos: number } | undefined
    try {
      doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === this.name) {
          if (from > pos && to < pos + node.nodeSize) {
            res = { node: node as any, pos }
          }
          return false
        }
        return
      })
    } catch {}
    return res
  }

  private _monacoEditorInstances = new Map<string, MonacoInstance>()
  private _checkEditorIdAttr(node: StrictProsemirrorNode<CodeBlockAttrs>): string {
    const { editorId } = node.attrs
    if (!editorId) {
      throw new Error(`Invalid editorId ${editorId}`)
    }
    return editorId
  }
  getMonacoEditorInstanceByNode(
    node: StrictProsemirrorNode<CodeBlockAttrs>
  ): MonacoInstance | undefined {
    return this._monacoEditorInstances.get(this._checkEditorIdAttr(node))
  }
  setMonacoEditorInstanceByNode(
    node: StrictProsemirrorNode<CodeBlockAttrs>,
    instance: MonacoInstance
  ) {
    return this._monacoEditorInstances.set(this._checkEditorIdAttr(node), instance)
  }
  deleteMonacoEditorInstanceByNode(node: StrictProsemirrorNode<CodeBlockAttrs>) {
    return this._monacoEditorInstances.delete(this._checkEditorIdAttr(node))
  }

  plugins(): Plugin[] {
    return [
      new Plugin({
        appendTransaction: (trs, prevState, nextState) => {
          // Ensure every CodeBlock node have a editorId attribute
          {
            let tr: Transaction | undefined
            nextState.doc.descendants((node, pos) => {
              if (node.type.name === this.name && !node.attrs['editorId']) {
                if (!tr) {
                  tr = nextState.tr
                }
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, editorId: nanoid() })
                return false
              }
              return true
            })
            if (tr) {
              return tr
            }
          }

          for (const tr of trs) {
            if (tr.getMeta(MonacoEditorTransactionMetaKey) === this.clientID) {
              continue
            }
            for (const step of tr.steps) {
              if (step instanceof ReplaceStep) {
                const from: number = (step as any).from
                const to: number = (step as any).to
                const codeBlock = this.isCodeBlock(prevState.doc, from, to)
                if (codeBlock) {
                  const slice: Slice = (step as any).slice
                  const { firstChild } = slice.content

                  if (
                    slice.content.childCount === 0 ||
                    (slice.content.childCount === 1 && firstChild?.isText)
                  ) {
                    const contentManager = this.getMonacoEditorInstanceByNode(
                      codeBlock.node
                    )?.contentManager

                    if (contentManager) {
                      const codePos = codeBlock.pos + 1
                      const index = from - codePos
                      const length = Math.abs(to - codePos - index)
                      if (firstChild?.text) {
                        if (length === 0) {
                          contentManager.insert(index, firstChild.text)
                        } else {
                          contentManager.replace(index, length, firstChild.text)
                        }
                      } else if (length > 0) {
                        contentManager.delete(index, length)
                      }
                    }
                  }
                }
              }
            }
          }

          return
        },
      }),
    ]
  }

  inputRules({ type }: { type: NodeType }): InputRule[] {
    return [
      textblockTypeInputRule(/^```([a-z]+)?\s$/, type, match => ({
        language: match[1],
      })),
    ]
  }

  nodeView(): NodeViewCreator<CodeBlockAttrs> {
    return ({ node, view, getPos }) => {
      if (typeof getPos !== 'function') {
        throw new Error(`Invalid getPos ${getPos}`)
      }

      return new CodeBlockNodeView(node, view, getPos, this.clientID, this)
    }
  }
}
