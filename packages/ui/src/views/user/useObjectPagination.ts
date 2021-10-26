// Copyright 2021 LiYechao
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

import Object from '@paper/core/src/object'
import { useEffect } from 'react'
import { atom, useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil'
import { accountSelector } from '../../state/account'

interface AccountObjectsState {
  iterator: AsyncIterator<Object>
  list: Object[]
  hasNext: boolean

  page: number
  limit: number
}

const accountObjectsState = atom<AccountObjectsState | null>({
  key: 'accountObjectsState',
  default: null,
  dangerouslyAllowMutability: true,
})

export interface ObjectPagination {
  list: Object[]
  page: number
  hasPrevious: boolean
  hasNext: boolean
  loadPrevious: () => Promise<void>
  loadNext: () => Promise<void>
}

export default function useObjectPagination({
  limit = 10,
}: { limit?: number } = {}): ObjectPagination {
  const account = useRecoilValue(accountSelector)
  const [state, setState] = useRecoilState(accountObjectsState)

  const withState = (cb: (s: AccountObjectsState) => Promise<void>) => {
    return async () => {
      const s = state ?? {
        iterator: account.objects(),
        list: [],
        hasNext: true,
        page: 0,
        limit,
      }
      s && (await cb(s))
    }
  }

  const loadPrevious = withState(async state => {
    if (state.page > 0) {
      setState({ ...state, page: state.page - 1 })
    }
  })

  const loadMore = async <T>(iterator: AsyncIterator<T>, limit: number) => {
    const list: T[] = []
    while (list.length < limit) {
      const next = await iterator.next()
      if (next.value) {
        list.push(next.value)
      } else {
        break
      }
    }
    return list
  }

  const loadNext = withState(async state => {
    const { iterator, page, limit, list } = state
    const newPage = page === 0 && list.length < limit ? 0 : page + 1
    // NOTE: Load one more to determine if there is a next page.
    const needLoadCount = (newPage + 1) * limit - list.length + 1
    const newList = needLoadCount > 0 ? list.concat(await loadMore(iterator, needLoadCount)) : list
    const hasNext = newList.length - list.length >= needLoadCount

    setState({
      ...state,
      list: newList,
      page: Math.max(0, Math.min(Math.ceil(list.length / limit) - 1, newPage)),
      hasNext,
    })
  })

  useEffect(() => {
    if (!state || state.list.length === 0) {
      loadNext()
    }
  }, [account])

  useEffect(() => {
    if (state && state.hasNext) {
      const needLoadCount = (state.page + 1) * state.limit - state.list.length + 1
      if (needLoadCount > 0) {
        loadMore(state.iterator, needLoadCount).then(objects => {
          setState({
            ...state,
            list: state.list.concat(objects),
            hasNext: objects.length >= needLoadCount,
          })
        })
      }
    }
  }, [state])

  if (!state) {
    return {
      list: [],
      page: 0,
      hasPrevious: false,
      hasNext: false,
      loadPrevious,
      loadNext,
    }
  }

  const page = Math.max(0, Math.min(Math.ceil(state.list.length / limit) - 1, state.page))
  const offset = page * state.limit

  return {
    list: state.list.slice(offset, offset + state.limit),
    page,
    hasPrevious: page > 0,
    hasNext: state.hasNext || page < Math.ceil(state.list.length / state.limit) - 1,
    loadPrevious,
    loadNext,
  }
}

export function useCreateObject() {
  return useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        const account = await snapshot.getPromise(accountSelector)
        const object = await account.createObject()
        set(
          accountObjectsState,
          v =>
            v && {
              ...v,
              list: [object].concat(v.list),
            }
        )
      },
    []
  )
}

export function useDeleteObject() {
  return useRecoilCallback(
    ({ set }) =>
      async (object: Object) => {
        set(
          accountObjectsState,
          v =>
            v && {
              ...v,
              list: v.list.filter(i => i !== object),
            }
        )
        await object.delete()
      },
    []
  )
}
