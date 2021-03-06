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
import { Keymap } from 'prosemirror-commands'
import { InputRule, wrappingInputRule } from 'prosemirror-inputrules'
import { NodeType } from 'prosemirror-model'
import { liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list'
import { findParentNodeOfType } from 'prosemirror-utils'
import { EditorView } from 'prosemirror-view'
import FormatListCheckbox from '../icons/FormatListCheckbox'
import { createMarkMenu, MenuComponentType } from '../lib/FloatingToolbar'
import isNodeActive from '../lib/isNodeActive'
import {
  Node,
  NodeViewCreator,
  NodeViewReact,
  StrictNodeSpec,
  StrictProsemirrorNode,
} from '../lib/Node'
import { canToggleBlockType } from '../lib/toggleBlockType'
import toggleWrap from '../lib/toggleWrap'

export interface TodoListAttrs {}

export default class TodoList implements Node<TodoListAttrs> {
  get name(): string {
    return 'todo_list'
  }

  get schema(): StrictNodeSpec<TodoListAttrs> {
    return {
      attrs: {},
      content: 'todo_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul[data-type="todo_list"]' }],
      toDOM: () => ['ul', { 'data-type': 'todo_list' }, 0],
    }
  }

  inputRules({ type }: { type: NodeType }): InputRule[] {
    return [wrappingInputRule(/^(\[\s?\])\s$/i, type)]
  }

  menus({ type }: { type: NodeType }): MenuComponentType[] {
    return [
      createMarkMenu({
        icon: <FormatListCheckbox />,
        isActive: isNodeActive(type),
        toggleMark: toggleWrap(type),
        isVisible: view => canToggleBlockType(view.state.selection),
      }),
    ]
  }

  childNodes = [new TodoItem({ todoItemReadOnly: false })]
}

interface TodoItemAttrs {
  checked: boolean | null
}

class TodoItem implements Node<TodoItemAttrs> {
  constructor(private options: { readonly todoItemReadOnly?: boolean } = {}) {}

  get name(): string {
    return 'todo_item'
  }

  get schema(): StrictNodeSpec<TodoItemAttrs> {
    return {
      attrs: { checked: { default: false } },
      content: 'paragraph block*',
      defining: true,
      draggable: true,
      parseDOM: [
        {
          tag: 'li[data-type="todo_item"]',
          priority: 100,
          getAttrs: dom => ({
            checked: (dom as HTMLElement).getAttribute('data-checked') === 'true',
          }),
        },
      ],
      toDOM: node => {
        return [
          'li',
          {
            'data-type': 'todo_item',
            'data-checked': node.attrs.checked ? 'true' : 'false',
          },
          ['div', 0],
        ]
      },
    }
  }

  keymap({ type }: { type: NodeType }): Keymap {
    return {
      Enter: (state, dispatch) => {
        return splitListItem(type)(state, tr => {
          const p = findParentNodeOfType(type)(tr.selection)
          if (p) {
            tr = tr.setNodeMarkup(p.pos, undefined, { ...p.node.attrs, checked: false })
          }
          dispatch?.(tr)
        })
      },
      'Mod-[': liftListItem(type),
      'Mod-]': sinkListItem(type),
    }
  }

  nodeView(): NodeViewCreator<TodoItemAttrs> {
    return ({ node, view, getPos }) => {
      if (typeof getPos !== 'function') {
        throw new Error(`Invalid getPos ${getPos}`)
      }

      return new TodoItemNodeView(node, view, getPos, this.options.todoItemReadOnly ?? true)
    }
  }
}

class TodoItemNodeView extends NodeViewReact<TodoItemAttrs> {
  constructor(
    node: StrictProsemirrorNode<TodoItemAttrs>,
    private view: EditorView,
    private getPos: () => number,
    private todoItemReadOnly: boolean
  ) {
    super(node)

    this.dom.classList.add(css`
      position: relative;
      list-style: none;
    `)
    this.reactDOM.classList.add(css`
      position: absolute;
      left: -32px;
      top: 0;
    `)
    const zero = document.createElement('span')
    zero.innerText = '\u200b'
    zero.classList.add(css`
      position: absolute;
      left: 0;
      top: 0;
      opacity: 0;
    `)

    this.dom.append(this.reactDOM, zero, this.contentDOM)
    this._render()
  }

  dom = document.createElement('li')
  reactDOM = document.createElement('span')
  override contentDOM = document.createElement('div')

  override ignoreMutation = (e: MutationRecord | { type: 'selection'; target: Element }) => {
    return this.reactDOM.contains(e.target)
  }

  get checked() {
    return this.node.attrs.checked === true
  }

  get disabled() {
    return this.todoItemReadOnly
  }

  component = () => {
    return (
      <_Checkbox
        type="checkbox"
        checked={this.checked}
        disabled={this.disabled}
        onChange={e => {
          e.target.focus()
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
              ...this.node.attrs,
              checked: e.target.checked,
            })
          )
        }}
      />
    )
  }
}

const _Checkbox = styled.input`
  vertical-align: middle;
`
