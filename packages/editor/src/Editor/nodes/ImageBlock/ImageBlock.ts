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
import { Schema } from 'prosemirror-model'
import { NodeType } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { removeParentNodeOfType } from 'prosemirror-utils'
import { Node, NodeViewCreator, ProsemirrorNode, StrictNodeSpec } from '../../lib/Node'
import ImageBlockNodeView from './ImageBlockNodeView'
import { getImageThumbnail, readAsDataURL } from './utils'

export interface ImageBlockOptions {
  upload: (file: File) => Promise<string> | string
  source: (src: string) => Promise<string> | string
  thumbnail: { maxSize: number }
}

export interface ImageBlockAttrs {
  src: string | null
  naturalWidth: number | null
  naturalHeight: number | null
  thumbnail: string | null
}

export default class ImageBlock implements Node<ImageBlockAttrs> {
  constructor(readonly options: ImageBlockOptions) {}

  static async create(
    schema: Schema,
    file: File,
    options: Pick<ImageBlockOptions, 'thumbnail'>
  ): Promise<ProsemirrorNode> {
    return getImageThumbnail(file, { maxSize: options.thumbnail.maxSize })
      .then(res =>
        readAsDataURL(res.thumbnail).then(thumbnail => ({
          ...res,
          thumbnail,
        }))
      )
      .then(({ thumbnail, naturalWidth, naturalHeight }) => {
        const node = schema.nodes['image_block']!.create(
          {
            src: null,
            thumbnail,
            naturalWidth,
            naturalHeight,
          },
          schema.text(file.name)
        )
        ;(node as any).file = file
        return node
      })
  }

  get name(): string {
    return 'image_block'
  }

  get schema(): StrictNodeSpec<ImageBlockAttrs> {
    return {
      attrs: {
        src: { default: null },
        naturalWidth: { default: null },
        naturalHeight: { default: null },
        thumbnail: { default: null },
      },
      content: 'text*',
      marks: '',
      group: 'block',
      draggable: true,
      isolating: true,
      parseDOM: [
        {
          tag: 'figure[data-type="image_block"]',
          getAttrs: dom => {
            if (dom instanceof HTMLElement) {
              const { dataset } = dom
              return {
                src: dataset['src'] || null,
                thumbnail: dataset['thumbnail'] || null,
                naturalWidth: Number(dataset['naturalWidth']) || null,
                naturalHeight: Number(dataset['naturalHeight']) || null,
              }
            }
            return undefined
          },
        },
      ],
      toDOM: ({ attrs }) => {
        return [
          'figure',
          {
            'data-type': 'image_block',
            'data-src': attrs.src,
            'data-thumbnail': attrs.thumbnail,
            'data-natural-width': attrs.naturalWidth?.toString(),
            'data-natural-height': attrs.naturalHeight?.toString(),
          },
          ['img'],
          ['figcaption', 0],
        ]
      },
      options: this.options,
    }
  }

  keymap({ type }: { type: NodeType }): Keymap {
    return {
      // NOTE: Move cursor to next node when input Enter.
      Enter: (state, dispatch) => {
        if (dispatch) {
          const { $from, $to } = state.selection
          const fromNode = $from.node($from.depth)
          const toNode = $to.node($to.depth)
          if (fromNode.type.name === 'image_block' && fromNode === toNode) {
            const endPos = $from.end($from.depth)
            const { tr } = state
            dispatch(
              tr
                .insert(endPos, type.schema.nodes['paragraph'].createAndFill())
                .setSelection(new TextSelection(tr.doc.resolve(endPos + 2)))
            )
            return true
          }
        }
        return false
      },
      // NOTE: Remove this node when backspace at first position.
      Backspace: (state, dispatch) => {
        const { $from, empty } = state.selection
        const fromNode = $from.node()
        if (dispatch && empty && fromNode.type.name === 'image_block' && $from.parentOffset === 0) {
          dispatch(removeParentNodeOfType(type)(state.tr))
          return true
        }
        return false
      },
    }
  }

  nodeView(): NodeViewCreator<ImageBlockAttrs> {
    return ({ node, view, getPos }) => {
      if (typeof getPos !== 'function') {
        throw new Error(`Invalid getPos ${getPos}`)
      }

      return new ImageBlockNodeView(node, view, getPos, this.options)
    }
  }
}
