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

import { css } from '@emotion/css'
import styled from '@emotion/styled'
import { setTextSelection } from 'prosemirror-utils'
import { EditorView } from 'prosemirror-view'
import React, { ChangeEvent, useCallback, useState } from 'react'
import CupertinoActivityIndicator from '../../lib/CupertinoActivityIndicator'
import { LazyComponent } from '../../lib/LazyComponent'
import { NodeViewReactSelectable, StrictProsemirrorNode } from '../../lib/Node'
import { CodeBlockAttrs } from './CodeBlock'
import { getLanguage, LANGUAGES } from './languages'

type MonacoInstance = import('./MonacoEditor').MonacoInstance

export const MonacoEditorTransactionMetaKey = 'MonacoEditorClientID'

const EDITOR_LINE_HEIGHT = 18
const SCROLLBAR_SIZE = 6

export interface MonacoEditorInstanceManager {
  setMonacoEditorInstanceByNode(
    node: StrictProsemirrorNode<CodeBlockAttrs>,
    instance: MonacoInstance
  ): void
  getMonacoEditorInstanceByNode(
    node: StrictProsemirrorNode<CodeBlockAttrs>
  ): MonacoInstance | undefined
  deleteMonacoEditorInstanceByNode(node: StrictProsemirrorNode<CodeBlockAttrs>): void
}

export default class CodeBlockNodeView extends NodeViewReactSelectable<CodeBlockAttrs> {
  constructor(
    node: StrictProsemirrorNode<CodeBlockAttrs>,
    private view: EditorView,
    private getPos: () => number,
    private clientId: string | number,
    private monacoInstanceManager: MonacoEditorInstanceManager
  ) {
    super(node)
    this.dom.classList.add(css`
      margin: 1em 0;
    `)
    this.dom.append(this.reactDOM)
    this._render()
  }

  dom = document.createElement('figure')

  reactDOM = document.createElement('div')

  override stopEvent = () => true

  override ignoreMutation = () => true

  override deselectNode = () => true

  onInsert = (index: number, text: string) => {
    const pos = this.getPos() + 1
    this.view.dispatch(
      this.view.state.tr
        .insertText(text, pos + index)
        .setMeta(MonacoEditorTransactionMetaKey, this.clientId)
    )
  }

  onReplace = (index: number, length: number, text: string) => {
    const pos = this.getPos() + 1
    this.view.dispatch(
      this.view.state.tr
        .insertText(text, pos + index, pos + index + length)
        .setMeta(MonacoEditorTransactionMetaKey, this.clientId)
    )
  }

  onDelete = (index: number, length: number) => {
    const pos = this.getPos() + 1
    this.view.dispatch(
      this.view.state.tr
        .delete(pos + index, pos + index + length)
        .setMeta(MonacoEditorTransactionMetaKey, this.clientId)
    )
  }

  onLanguageChange = (language: string) => {
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
        ...this.node.attrs,
        language,
      })
    )
  }

  private get language(): string | undefined {
    return getLanguage(this.node.attrs.language || 'plaintext')
  }

  private isAtFirstPosition = false

  private MonacoEditor = React.lazy(() => import('./MonacoEditor'))

  component = React.memo(
    ({ node }: { node: StrictProsemirrorNode<CodeBlockAttrs> }) => {
      const { MonacoEditor } = this
      const [visible, setVisible] = useState(false)
      const [contentHeight, setContentHeight] = useState(() => {
        return node.textContent.split('\n').length * EDITOR_LINE_HEIGHT + SCROLLBAR_SIZE
      })

      const onVisibleChange = useCallback((visible: boolean) => {
        visible && setVisible(true)
      }, [])

      const handleLanguageChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
        this.onLanguageChange?.(e.target.value)
      }, [])

      const handleLanguageMouseUp = useCallback((e: React.MouseEvent) => e.stopPropagation(), [])

      const fallback = (
        <_Loading>
          <CupertinoActivityIndicator size={24} />
        </_Loading>
      )

      return (
        <LazyComponent component={_Container} onVisibleChange={onVisibleChange}>
          <_LanguageSelect
            className="language-select"
            value={this.language}
            tabIndex={-1}
            disabled={!this.view.editable}
            onChange={handleLanguageChange}
            onMouseUp={handleLanguageMouseUp}
          >
            {LANGUAGES.map(lang => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </_LanguageSelect>

          <_Content style={{ minHeight: contentHeight }}>
            {!visible ? (
              fallback
            ) : (
              <React.Suspense fallback={fallback}>
                <MonacoEditor
                  lineHeight={EDITOR_LINE_HEIGHT}
                  defaultValue={this.node.textContent}
                  language={this.language}
                  readOnly={!this.view.editable}
                  focused={this.selected}
                  clientID={this.clientId}
                  tabIndex={-1}
                  onInited={e => {
                    e.editor.onDidContentSizeChange(e => {
                      setContentHeight(
                        e.contentHeight % EDITOR_LINE_HEIGHT === 0
                          ? e.contentHeight + SCROLLBAR_SIZE
                          : e.contentHeight
                      )
                    })
                    this.monacoInstanceManager.setMonacoEditorInstanceByNode(this.node, e)
                  }}
                  onDestroyed={() =>
                    this.monacoInstanceManager.deleteMonacoEditorInstanceByNode(this.node)
                  }
                  onInsert={this.onInsert}
                  onReplace={this.onReplace}
                  onDelete={this.onDelete}
                  onKeyDown={(_, editor) => {
                    const selection = editor.getSelection()
                    this.isAtFirstPosition =
                      (selection &&
                        selection.isEmpty() &&
                        selection.getPosition().equals({ lineNumber: 1, column: 1 })) ??
                      false
                  }}
                  onKeyUp={e => {
                    // KeyCode.Backspace is 1
                    if (e.keyCode === 1 && this.isAtFirstPosition) {
                      this.view.dispatch(
                        setTextSelection(this.getPos())(
                          this.view.state.tr.setNodeMarkup(
                            this.getPos(),
                            this.view.state.schema.nodes['paragraph']
                          )
                        )
                      )
                      this.view.focus()
                    }
                  }}
                />
              </React.Suspense>
            )}
          </_Content>
        </LazyComponent>
      )
    },
    (prev, next) => prev.node.attrs.language === next.node.attrs.language
  )
}

const _Container = styled.div`
  margin: 16px 0;
  position: relative;
  padding: 8px 0;
  border-radius: 4px;
  background-color: #f5f5f5;

  .margin-view-overlays *::selection {
    background-color: transparent;
  }

  .language-select {
    display: none;
  }

  &:hover {
    .language-select {
      display: block;
    }
  }
`

const _Content = styled.div`
  position: relative;
`

const _Loading = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`

const _LanguageSelect = styled.select`
  position: absolute;
  right: 8px;
  top: 8px;
  z-index: 10;
`
