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

import styled from '@emotion/styled'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import LexicalComposer from '@lexical/react/LexicalComposer'
import LexicalContentEditable from '@lexical/react/LexicalContentEditable'
import LexicalLinkPlugin from '@lexical/react/LexicalLinkPlugin'
import LexicalMarkdownShortcutPlugin from '@lexical/react/LexicalMarkdownShortcutPlugin'
import LexicalRichTextPlugin from '@lexical/react/LexicalRichTextPlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { $getRoot } from 'lexical'
import { ComponentProps } from 'react'
import CodeHighlightPlugin from '../plugins/CodeHighlightPlugin'
import FloatingToolbarPlugin, {
  ToggleBlockButton,
  ToggleFormatButton,
  ToggleLinkButton,
} from '../plugins/FloatingToolbarPlugin'
import initialEditorStateFromProsemirrorDoc from '../prosemirror/initialEditorStateFromProsemirrorDoc '
import theme from '../themes/theme'
import { PROSEMIRROR_DOCUMENT } from './prosemirrorDocument'

export interface EditorProps {
  className?: string
}

export default function Editor(props: EditorProps) {
  const initialConfig: ComponentProps<typeof LexicalComposer>['initialConfig'] = {
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableRowNode,
      TableCellNode,
    ],
    theme,
    onError: e => {
      throw e
    },
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <EditorContainer className={props.className}>
        <LexicalRichTextPlugin
          contentEditable={<ContentEditable />}
          placeholder={<Placeholder>Input something...</Placeholder>}
          initialEditorState={() =>
            initialEditorStateFromProsemirrorDoc($getRoot(), PROSEMIRROR_DOCUMENT)
          }
        />
        <LexicalLinkPlugin />
        <CodeHighlightPlugin />
        <LexicalMarkdownShortcutPlugin />

        <FloatingToolbarPlugin>
          <ToggleFormatButton type="bold" />
          <ToggleFormatButton type="italic" />
          <ToggleFormatButton type="underline" />
          <ToggleFormatButton type="strikethrough" />
          <ToggleFormatButton type="code" />
          <ToggleLinkButton />
          <ToggleBlockButton type="h1" />
          <ToggleBlockButton type="h2" />
          <ToggleBlockButton type="h3" />
          <ToggleBlockButton type="quote" />
          <ToggleBlockButton type="ol" />
          <ToggleBlockButton type="ul" />

          <FloatingToolbarPlugin.Extras>
            <ToggleLinkButton.Extra />
          </FloatingToolbarPlugin.Extras>
        </FloatingToolbarPlugin>
      </EditorContainer>
    </LexicalComposer>
  )
}

const EditorContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
`

const ContentEditable = styled(LexicalContentEditable)`
  outline: none;
  flex-grow: 1;
`

const Placeholder = styled.div`
  font-size: 14px;
  color: #999;
  overflow: hidden;
  position: absolute;
  text-overflow: ellipsis;
  top: 0;
  left: 0;
  user-select: none;
  white-space: nowrap;
  display: inline-block;
  pointer-events: none;
`
