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

import { Keymap } from 'prosemirror-commands'
import { InputRule } from 'prosemirror-inputrules'
import { MarkSpec, MarkType } from 'prosemirror-model'
import FormatStrikethrough from '../icons/FormatStrikethrough'
import { createMarkMenu, MenuComponentType } from '../lib/FloatingToolbar'
import isMarkActive from '../lib/isMarkActive'
import { Mark } from '../lib/Mark'
import markInputRule from '../lib/markInputRule'
import toggleMark from '../lib/toggleMark'

export default class Strikethrough implements Mark {
  get name() {
    return 'strikethrough'
  }

  get schema(): MarkSpec {
    return {
      parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }],
      toDOM: () => ['del', 0],
    }
  }

  inputRules({ type }: { type: MarkType }): InputRule[] {
    return [markInputRule(/~([^~]+)~$/, type)]
  }

  keymap({ type }: { type: MarkType }): Keymap {
    return {
      'Mod-d': toggleMark(type),
    }
  }

  menus({ type }: { type: MarkType }): MenuComponentType[] {
    return [
      createMarkMenu({
        icon: <FormatStrikethrough />,
        isActive: isMarkActive(type),
        toggleMark: toggleMark(type),
      }),
    ]
  }
}
