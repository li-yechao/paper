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

import { Account } from '@paper/core'
import { Object, ObjectInfo, objectInfoSchema } from '@paper/core'
import { DocJson } from '@paper/editor'
import Ajv, { JTDSchemaType } from 'ajv/dist/jtd'
import { customAlphabet } from 'nanoid'
import { useMemo } from 'react'
import { useObject } from './object'

export class Paper {
  constructor(readonly object: Object) {}

  get info() {
    return this.object.info.then(info => {
      if (!validatePaperInfo(info)) {
        throw new Error(`Invalid paper info`)
      }
      return info
    })
  }

  async setInfo(info: Partial<PaperInfo> = {}) {
    this.object.setInfo(info)
  }

  private readonly contentFilePath = '/paper.json'

  async setContent(content: DocJson) {
    await this.object.write(this.contentFilePath, JSON.stringify(content), {
      parents: true,
      create: true,
      truncate: true,
    })
  }

  async getContent(): Promise<DocJson | undefined> {
    try {
      const buffer = await this.object.read(this.contentFilePath)
      const str = new TextDecoder().decode(buffer)
      return upgradeSchema(JSON.parse(str))
    } catch (error: any) {
      if (error.code === 'ERR_NOT_FOUND') {
        return
      }
      throw error
    }
  }

  static fileId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 32)

  async addResource(files: File[]): Promise<string> {
    const tmp = `files/${Paper.fileId()}`
    for (const file of files) {
      const buffer = await file.arrayBuffer()
      await this.object.write(`${tmp}/${file.name}`, buffer, {
        parents: true,
        create: true,
        truncate: true,
      })
    }
    const cid = (await this.object.files.stat(tmp)).cid.toString()
    await this.object.files.mv(tmp, `files/${cid}`)
    return cid
  }

  async getResource(cid: string, filename: string): Promise<File> {
    const buffer = await this.object.read(`files/${cid}/${filename}`)
    return new File([new Blob([buffer])], filename)
  }
}

export interface PaperInfo extends ObjectInfo {
  tags?: string[]
}

const paperInfoSchema: JTDSchemaType<PaperInfo> = {
  properties: {
    ...objectInfoSchema.properties,
  },
  optionalProperties: {
    ...objectInfoSchema.optionalProperties,
    tags: { elements: { type: 'string' } },
  },
  additionalProperties: true,
} as const

const validatePaperInfo = new Ajv().compile(paperInfoSchema)

export function usePaper({ account, objectId }: { account: Account; objectId: string }) {
  const object = useObject({ account, objectId })
  const paper = useMemo(() => new Paper(object), [object])
  return paper
}

function upgradeSchema(node: DocJson): DocJson {
  if (!node) {
    return node
  }
  return {
    ...node,
    type: node.type === 'ordered_item' || node.type === 'bullet_item' ? 'list_item' : node.type,
    content: node.content?.map(upgradeSchema),
  }
}
