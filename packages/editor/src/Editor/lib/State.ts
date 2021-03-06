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

import { InputRule, inputRules } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { MarkSpec, NodeSpec, Schema, Node as ProsemirrorNode } from 'prosemirror-model'
import { EditorState, Plugin, Transaction } from 'prosemirror-state'
import { Decoration, DirectEditorProps, EditorView, NodeView } from 'prosemirror-view'
import { Mark } from './Mark'
import { Node } from './Node'
import { Extension } from './Extension'
import { MenuComponentType } from './FloatingToolbar'

export interface StateOptions {
  extensions?: Extension[]
  nodes: Node<any>[]
  marks: Mark[]
}

export default class State {
  constructor(readonly options: StateOptions) {
    this.schema = new Schema({
      nodes: this.nodeSpecs,
      marks: this.markSpecs,
    })
  }

  private readonly schema: Schema

  private get nodes(): Node<any>[] {
    return this.options.nodes.concat(this.options.nodes.flatMap(n => n.childNodes ?? []))
  }

  private get nodeSpecs(): { [key: string]: NodeSpec } {
    return this.nodes.reduce((res, i) => ({ ...res, [i.name]: i.schema }), {})
  }

  private get marks(): Mark[] {
    return this.options.marks
  }

  private get markSpecs(): { [key: string]: MarkSpec } {
    return this.marks.reduce((res, i) => ({ ...res, [i.name]: i.schema }), {})
  }

  private get menus(): MenuComponentType[] {
    return this.marks
      .flatMap(i => i.menus?.({ type: this.schema.marks[i.name]! }) ?? [])
      .concat(this.nodes.flatMap(i => i.menus?.({ type: this.schema.nodes[i.name]! }) ?? []))
  }

  private async plugins(): Promise<Plugin[]> {
    return this.nodes
      .map(i => i.plugins?.() ?? [])
      .flat()
      .concat(
        this.options.extensions
          ?.map(i => i.plugins?.() ?? [])
          .flat()
          .concat() ?? []
      )
  }

  private get inputRules(): InputRule[] {
    return this.nodes
      .flatMap(i => i.inputRules?.({ type: this.schema.nodes[i.name]! }) ?? [])
      .concat(this.marks.flatMap(i => i.inputRules?.({ type: this.schema.marks[i.name]! })) ?? [])
  }

  private get keymap(): Plugin[] {
    return this.nodes
      .map(i => keymap(i.keymap?.({ type: this.schema.nodes[i.name]! }) ?? {}))
      .concat(this.marks.map(i => keymap(i.keymap?.({ type: this.schema.marks[i.name]! }) ?? {})))
  }

  private get nodeViews() {
    return this.nodes.reduce<{
      [name: string]: (
        node: ProsemirrorNode,
        view: EditorView,
        getPos: (() => number) | boolean,
        decorations: Decoration[]
      ) => NodeView
    }>((res, i) => {
      const nodeView = i.nodeView?.()
      if (nodeView) {
        res[i.name] = (node, view, getPos) => nodeView({ node, view, getPos })
      }
      return res
    }, {})
  }

  private async createState() {
    const defaultValue = this.options.extensions?.find(i => i.defaultValue)?.defaultValue?.()

    return EditorState.create({
      schema: this.schema,
      doc: defaultValue && ProsemirrorNode.fromJSON(this.schema, defaultValue),
      plugins: [inputRules({ rules: this.inputRules }), ...this.keymap, ...(await this.plugins())],
    })
  }

  private get dispatchTransactionHandlers() {
    return (
      this.options.extensions
        ?.map(i => i.dispatchTransaction)
        .filter((i): i is (view: EditorView, tr: Transaction) => void => !!i) ?? []
    )
  }

  private _editorState?: EditorState

  get doc() {
    return this._editorState?.doc
  }

  async createEditor(
    place:
      | globalThis.Node
      | ((p: globalThis.Node) => void)
      | { mount: globalThis.Node }
      | undefined,
    props: Omit<DirectEditorProps, 'state' | 'nodeViews'>
  ): Promise<{ view: EditorView; menus: MenuComponentType[] }> {
    const { dispatchTransactionHandlers } = this

    const onStateChange = (state: EditorState) => (this._editorState = state)

    const view = new EditorView(place, {
      ...props,
      state: this._editorState ?? (await this.createState()),
      nodeViews: this.nodeViews,
      dispatchTransaction: function (tr) {
        view.updateState(view.state.apply(tr))

        props.dispatchTransaction?.call(this, tr)

        for (const f of dispatchTransactionHandlers) {
          f(view, tr)
        }

        onStateChange(view.state)
      },
    })

    for (const node of this.nodes) {
      node.view = view
    }

    return { view, menus: this.menus }
  }
}
