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

import { InputRule, wrappingInputRule } from 'prosemirror-inputrules'
import { NodeType } from 'prosemirror-model'
import FormatQuote from '../icons/FormatQuote'
import { createMarkMenu, MenuComponentType } from '../lib/FloatingToolbar'
import isNodeActive from '../lib/isNodeActive'
import { Node, StrictNodeSpec } from '../lib/Node'
import { canToggleBlockType } from '../lib/toggleBlockType'
import toggleWrap from '../lib/toggleWrap'

export interface BlockquoteAttrs {}

export default class Blockquote implements Node<BlockquoteAttrs> {
  get name(): string {
    return 'blockquote'
  }

  get schema(): StrictNodeSpec<BlockquoteAttrs> {
    return {
      attrs: {},
      content: 'block+',
      group: 'block',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: () => ['blockquote', 0],
    }
  }

  inputRules({ type }: { type: NodeType }): InputRule[] {
    return [wrappingInputRule(/^\s*>\s$/, type)]
  }

  menus({ type }: { type: NodeType }): MenuComponentType[] {
    return [
      createMarkMenu({
        icon: <FormatQuote />,
        isActive: isNodeActive(type),
        toggleMark: toggleWrap(type),
        isVisible: view => canToggleBlockType(view.state.selection),
      }),
    ]
  }
}
