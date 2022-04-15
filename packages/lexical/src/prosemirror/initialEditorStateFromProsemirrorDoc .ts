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

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { $createCodeNode } from '@lexical/code'
import { $createLinkNode } from '@lexical/link'
import { $createListItemNode, $createListNode } from '@lexical/list'
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { $createTableCellNode, $createTableNode, $createTableRowNode } from '@lexical/table'
import { $createParagraphNode, $createTextNode, ElementNode, RootNode } from 'lexical'

export default function initialEditorStateFromProsemirrorDoc(root: RootNode, doc: string) {
  const json = JSON.parse(doc)
  root.clear()

  if (json?.type !== 'doc' || !json?.content?.length) {
    return
  }

  for (const child of json.content) {
    parseBlock(root, child)
  }
}

function parseBlock(parent: ElementNode, block: any) {
  switch (block.type) {
    case 'heading': {
      const node = $createHeadingNode(`h${block.attrs.level}` as any)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      parseContents(node, block.content)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      parent.append(node)
      break
    }
    case 'paragraph': {
      const node = $createParagraphNode()
      parseContents(node, block.content)
      parent.append(node)
      break
    }
    case 'blockquote': {
      const node = $createQuoteNode()
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      parseContents(node, block.content)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      parent.append(node)
      break
    }
    case 'ordered_list': {
      const node = $createListNode('ol')
      parseContents(node, block.content)
      parent.append(node)
      break
    }
    case 'bullet_list': {
      const node = $createListNode('ul')
      parseContents(node, block.content)
      parent.append(node)
      break
    }
    case 'list_item': {
      const node = $createListItemNode()
      parseContents(node, block.content)
      parent.append(node)
      break
    }
    case 'code_block': {
      const node = $createCodeNode(block.attrs.language)
      parseContents(node, block.content)
      parent.append(node)
      break
    }
    case 'image_block': {
      break
    }
    case 'table': {
      const node = $createTableNode()
      parseContents(node, block.content)
      parent.append(node)
      break
    }
    case 'tr': {
      const node = $createTableRowNode()
      parseContents(node, block.content)
      parent.append(node)
      break
    }
    case 'th': {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const node = $createTableCellNode(1)
      parseContents(node, block.content)
      parent.append(node)
      break
    }
    case 'td': {
      const node = $createTableCellNode()
      parseContents(node, block.content)
      parent.append(node)
      break
    }
    case 'text': {
      const text = $createTextNode(block.text)
      for (const mark of block.marks ?? []) {
        switch (mark.type) {
          case 'bold': {
            text.toggleFormat('bold')
            break
          }
          case 'italic': {
            text.toggleFormat('italic')
            break
          }
          case 'underline': {
            text.toggleFormat('underline')
            break
          }
          case 'strikethrough': {
            text.toggleFormat('strikethrough')
            break
          }
          case 'code': {
            text.toggleFormat('code')
            break
          }
          case 'highlight': {
            break
          }
          case 'link': {
            break
          }
          default:
            throw new Error(`Unsupported inline mark ${mark.type}`)
        }
      }
      const link = block.marks?.find((i: any) => i.type === 'link')
      if (link) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        parent.append($createLinkNode(link.href).append(text))
      } else {
        parent.append(text)
      }
      break
    }

    default:
      throw new Error(`Unsupported block type ${block.type}`)
  }
}

function parseContents(parent: ElementNode, contents: any) {
  for (const child of contents ?? []) {
    parseBlock(parent, child)
  }
}
