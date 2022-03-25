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
import { useParams } from 'react-router-dom'
import ObjectEditor from './ObjectEditor'
import ObjectList from './ObjectList'

export default function MainView() {
  const { objectId } = useParams()

  return (
    <_MainView>
      <aside>
        <ObjectList objectId={objectId} />
      </aside>
      <main>{objectId && <ObjectEditor objectId={objectId} />}</main>
    </_MainView>
  )
}

const _MainView = styled.div`
  padding-left: 200px;
  padding-top: 48px;

  > aside {
    position: fixed;
    left: 0;
    top: 48px;
    bottom: 0;
    width: 200px;
    border-right: 1px solid #efefef;
  }
`