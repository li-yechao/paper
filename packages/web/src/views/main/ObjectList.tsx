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

import { gql, QueryHookOptions, useQuery, useSubscription } from '@apollo/client'
import styled from '@emotion/styled'
import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtual } from 'react-virtual'

export default function ObjectList({ objectId }: { objectId?: string }) {
  const navigate = useNavigate()
  const { data: { viewer } = {}, fetchMore, loading } = useObjects({ variables: { first: 10 } })

  const { data: { objectCreated } = {} } = useSubscription<{
    objectCreated: { id: string; meta?: { title?: string } }
  }>(
    gql`
      subscription ObjectCreated {
        objectCreated {
          id
        }
      }
    `
  )
  useEffect(() => {
    const first = viewer?.objects.edges.at(0)
    if (objectCreated && first) {
      fetchMore({ variables: { before: first.cursor, last: 10, first: null } })
    }
  }, [objectCreated, viewer])

  const parentRef = useRef<HTMLDivElement>(null)

  const virtual = useVirtual({
    size: viewer?.objects.edges.length || 0,
    parentRef,
    estimateSize: useCallback(() => 32, []),
  })

  useEffect(() => {
    if (loading) {
      return
    }

    const last = virtual.virtualItems.at(-1)
    const { edges, pageInfo } = viewer?.objects ?? {}
    const after = edges?.at(-1)?.cursor
    if (!last || !edges || !after || !pageInfo) {
      return
    }

    if (last.index >= edges.length - 1 && pageInfo.hasNextPage) {
      fetchMore({ variables: { after } })
    }
  }, [loading, virtual.virtualItems])

  return (
    <_List ref={parentRef}>
      <div style={{ height: `${virtual.totalSize}px`, position: 'relative' }}>
        {virtual.virtualItems.map(row => {
          const edge = viewer?.objects.edges[row.index]
          if (!edge) {
            throw new Error('The edges index overflow')
          }

          return (
            <_Item
              key={edge.node.id}
              className={objectId === edge.node.id ? 'selected' : ''}
              style={{
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`,
              }}
              onClick={() => navigate(`/me/${edge.node.id}`)}
            >
              {edge.node.meta?.title || 'Untitled'}
            </_Item>
          )
        })}
      </div>
    </_List>
  )
}

const _List = styled.div`
  height: 100%;
  overflow-y: auto;
`

const _Item = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
  cursor: pointer;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 32px;
  line-height: 32px;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  &.selected {
    background-color: rgba(0, 0, 0, 0.1);
  }
`

const OBJECTS_QUERY = gql`
  query Objects($before: String, $after: String, $first: Int, $last: Int) {
    viewer {
      id

      objects(before: $before, after: $after, first: $first, last: $last) {
        edges {
          cursor
          node {
            id
            createdAt
            updatedAt
            meta
          }
        }

        pageInfo {
          hasNextPage
        }
      }
    }
  }
`

const useObjects = (
  options?: QueryHookOptions<
    {
      viewer: {
        id: string
        objects: {
          edges: {
            cursor: string
            node: { id: string; createdAt: string; updatedAt: string; meta?: { title?: string } }
          }[]
          pageInfo: {
            hasNextPage: boolean
          }
        }
      }
    },
    { before?: string; after?: string; first?: number; last?: number }
  >
) => {
  return useQuery(OBJECTS_QUERY, options)
}