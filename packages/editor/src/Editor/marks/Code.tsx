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
import markInputRule from '../lib/markInputRule'
import toggleMark from '../lib/toggleMark'
import { Mark } from '../lib/Mark'

export default class Code implements Mark {
  get name() {
    return 'code'
  }

  get schema(): MarkSpec {
    return {
      excludes: '_',
      parseDOM: [{ tag: 'code' }],
      toDOM: () => ['code'],
    }
  }

  inputRules({ type }: { type: MarkType }): InputRule[] {
    return [markInputRule(/(?:^|[^`])(`([^`]+)`)$/, type)]
  }

  keymap({ type }: { type: MarkType }): Keymap {
    return {
      'Mod`': toggleMark(type),
    }
  }
}