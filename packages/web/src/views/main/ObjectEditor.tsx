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

import { LoadingOutlined } from '@ant-design/icons'
import {
  gql,
  LazyQueryHookOptions,
  MutationHookOptions,
  QueryHookOptions,
  useLazyQuery,
  useMutation,
  useQuery,
} from '@apollo/client'
import styled from '@emotion/styled'
import Editor, {
  baseKeymap,
  Blockquote,
  Bold,
  BulletList,
  Code,
  Doc,
  dropCursor,
  DropPasteFile,
  gapCursor,
  Heading,
  Highlight,
  history,
  ImageBlock,
  Italic,
  keymap,
  Link,
  Math,
  OrderedList,
  Paragraph,
  Plugins,
  redo,
  State,
  Strikethrough,
  Text,
  Underline,
  undo,
  undoInputRule,
  Value,
} from '@paper/editor'
import { ProsemirrorNode } from '@paper/editor/src/Editor/lib/Node'
import { message, Spin } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { toString } from 'uint8arrays'
import useOnSave from '../../utils/useOnSave'
import { usePrompt } from '../../utils/usePrompt'

export default function ObjectEditor({ objectId }: { objectId: string }) {
  const object = useObject({ variables: { objectId } })

  if (object.error) {
    throw object.error
  } else if (object.loading) {
    return (
      <_Loading>
        <Spin indicator={<LoadingOutlined spin />} />
      </_Loading>
    )
  } else if (object.data) {
    return <_ObjectEditor object={object.data.viewer.object} />
  }
  return null
}

const _Loading = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 40vh;
`

const _ObjectEditor = ({ object }: { object: { id: string; data?: string } }) => {
  const [updateObject] = useUpdateObject()
  const [doc, setDoc] = useState<ProsemirrorNode>()
  const [changed, setChanged] = useState(false)

  useEffect(() => {
    setChanged(false)
  }, [object])

  useOnSave(() => {
    if (!doc) {
      return
    }
    const data = JSON.stringify(doc.toJSON())
    setChanged(false)
    updateObject({
      variables: {
        objectId: object.id,
        input: { meta: { title: doc.content.maybeChild(0)?.textContent }, data },
      },
    })
      .then(() => {
        message.success('Save Success')
      })
      .catch(error => {
        message.error(error.message)
        throw error
      })
  }, [object, doc])

  usePrompt('Discard changes?', changed)

  const [createObject] = useCreateObject()
  const [queryObjectCid] = useObjectUriLazy()

  const state = useMemo(() => {
    return new State({
      nodes: [
        new Doc(),
        new Text(),
        new Paragraph(),
        new Heading(),
        new Blockquote(),
        new OrderedList(),
        new BulletList(),
        new Math(),
        new ImageBlock({
          upload: async file => {
            const data = toString(new Uint8Array(await file.arrayBuffer()), 'base64')
            const res = await createObject({
              variables: {
                parentId: object.id,
                input: {
                  meta: { type: 'image' },
                  data,
                  encoding: 'BASE64',
                },
              },
            })
            if (res.errors || !res.data) {
              throw new Error(res.errors?.[0]?.message || 'upload file failed')
            }
            return res.data.createObject.id
          },
          source: async src => {
            const res = await queryObjectCid({ variables: { objectId: src } })
            if (!res.data || res.error) {
              throw res.error || new Error('query object cid failed')
            }
            const uri = res.data.viewer.object.uri
            if (!uri) {
              throw new Error('object cid not found')
            }
            return uri
          },
          thumbnail: { maxSize: 1024 },
        }),
      ],
      marks: [
        new Bold(),
        new Code(),
        new Highlight(),
        new Italic(),
        new Link(),
        new Strikethrough(),
        new Underline(),
      ],
      extensions: [
        new Plugins([
          keymap({
            'Mod-z': undo,
            'Shift-Mod-z': redo,
            'Mod-y': redo,
            Backspace: undoInputRule,
          }),
          keymap(baseKeymap),
          history(),
          gapCursor(),
          dropCursor({ color: 'currentColor' }),
        ]),
        new Value({
          defaultValue: object.data ? JSON.parse(object.data) : undefined,
          onDispatchTransaction: (view, tr) => {
            if (tr.docChanged) {
              setDoc(view.state.doc)
              setChanged(true)
            }
          },
        }),
        new DropPasteFile({
          create: (view, file) => {
            const imageBlock = view.state.schema.nodes['image_block']
            if (imageBlock && file.type.startsWith('image/')) {
              return ImageBlock.create(view.state.schema, file, imageBlock.spec.options)
            }
            return
          },
        }),
      ],
    })
  }, [object])

  return <_Editor state={state} />
}

const _Editor = styled(Editor)`
  min-height: calc(100vh - 100px);
`

const OBJECT_QUERY = gql`
  query Object($objectId: String!) {
    viewer {
      id

      object(objectId: $objectId) {
        id
        createdAt
        updatedAt
        meta
        data
      }
    }
  }
`

const useObject = (
  options?: QueryHookOptions<
    {
      viewer: {
        id: string
        object: {
          id: string
          createdAt: string
          updatedAt: string
          meta?: unknown
          data?: string
        }
      }
    },
    { objectId: string }
  >
) => {
  return useQuery(OBJECT_QUERY, options)
}

const UPDATE_OBJECT_MUTATION = gql`
  mutation UpdateObject($objectId: String!, $input: UpdateObjectInput!) {
    updateObject(objectId: $objectId, input: $input) {
      id
      createdAt
      updatedAt
      meta
      data
    }
  }
`

const useUpdateObject = (
  options?: MutationHookOptions<
    {
      updateObject: {
        id: string
        createdAt: string
        updatedAt: string
        meta?: unknown
        data?: string
      }
    },
    {
      objectId: string
      input: {
        meta?: { title?: string }
        data?: string
      }
    }
  >
) => {
  return useMutation(UPDATE_OBJECT_MUTATION, options)
}

const CREATE_OBJECT_MUTATION = gql`
  mutation CreateObject($parentId: String, $input: CreateObjectInput!) {
    createObject(parentId: $parentId, input: $input) {
      id
      meta
      cid
    }
  }
`

const useCreateObject = (
  options?: MutationHookOptions<
    {
      createObject: {
        id: string
        meta?: unknown
        cid?: string
      }
    },
    {
      parentId?: string
      input: {
        meta?: unknown
        data?: string
        encoding?: 'BASE64'
      }
    }
  >
) => {
  return useMutation(CREATE_OBJECT_MUTATION, options)
}

const OBJECT_URI_QUERY = gql`
  query Object($objectId: String!) {
    viewer {
      id

      object(objectId: $objectId) {
        id
        uri
      }
    }
  }
`

const useObjectUriLazy = (
  options?: LazyQueryHookOptions<
    {
      viewer: {
        id: string
        object: {
          id: string
          uri?: string
        }
      }
    },
    { objectId: string }
  >
) => {
  return useLazyQuery(OBJECT_URI_QUERY, options)
}
