<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getNotes, createNote, updateNote, deleteNote } from '../api/client'
import type { Note } from '../types'

const notes = ref<Note[]>([])
const total = ref(0)
const loading = ref(true)
const searchQuery = ref('')

// Edit dialog
const showEdit = ref(false)
const editingNote = ref<Note | null>(null)
const editContent = ref('')
const editKeywords = ref('')

// Create dialog
const showCreate = ref(false)
const newContent = ref('')
const newKeywords = ref('')

async function loadNotes() {
  loading.value = true
  try {
    const result = await getNotes(searchQuery.value, 500)
    notes.value = result.notes
    total.value = result.total
  } catch (e) {
    console.error('Failed to load notes:', e)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  newContent.value = ''
  newKeywords.value = ''
  showCreate.value = true
}

async function doCreate() {
  if (!newContent.value.trim()) return
  try {
    await createNote(newContent.value, newKeywords.value)
    showCreate.value = false
    await loadNotes()
  } catch (e) {
    console.error('Failed to create note:', e)
  }
}

function openEdit(note: Note) {
  editingNote.value = note
  editContent.value = note.content
  editKeywords.value = note.keywords
  showEdit.value = true
}

async function doEdit() {
  if (!editingNote.value || !editContent.value.trim()) return
  try {
    await updateNote(editingNote.value.id, {
      content: editContent.value,
      keywords: editKeywords.value,
    })
    showEdit.value = false
    editingNote.value = null
    await loadNotes()
  } catch (e) {
    console.error('Failed to update note:', e)
  }
}

async function doDelete(note: Note) {
  if (!confirm(`确认删除笔记 #${note.id}？`)) return
  try {
    await deleteNote(note.id)
    await loadNotes()
  } catch (e) {
    console.error('Failed to delete note:', e)
  }
}

function formatTime(ts: number): string {
  try {
    const d = new Date(ts * 1000)
    return d.toLocaleString('zh-CN')
  } catch { return String(ts) }
}

onMounted(loadNotes)
</script>

<template>
  <div class="notes-page">
    <div class="page-header">
      <h2>笔记 ({{ total }})</h2>
      <div class="header-actions">
        <input
          v-model="searchQuery"
          placeholder="搜索笔记内容..."
          class="search-input"
          @input="loadNotes"
        />
        <button class="btn btn-primary btn-sm" @click="openCreate">+ 新建笔记</button>
      </div>
    </div>

    <div class="notes-list" v-if="!loading">
      <div v-for="note in notes" :key="note.id" class="note-card card" @click="openEdit(note)">
        <div class="note-header">
          <span class="note-id">#{{ note.id }}</span>
          <span v-if="note.keywords" class="note-keywords">{{ note.keywords }}</span>
          <span class="note-context">{{ note.context_id }}</span>
          <span class="note-time">{{ formatTime(note.created_time) }}</span>
          <button class="btn btn-sm btn-danger note-del" @click.stop="doDelete(note)">删除</button>
        </div>
        <div class="note-content">{{ note.content }}</div>
        <div v-if="note.expire_time" class="note-expire">过期: {{ new Date(note.expire_time).toLocaleString('zh-CN') }}</div>
      </div>
      <div v-if="notes.length === 0" class="empty-state">暂无笔记</div>
    </div>
    <div v-if="loading" class="loading-state">加载中...</div>

    <!-- Create modal -->
    <div v-if="showCreate" class="overlay" @click.self="showCreate = false">
      <div class="modal">
        <h3>新建笔记</h3>
        <div class="form-group">
          <label>内容</label>
          <textarea v-model="newContent" placeholder="笔记内容"></textarea>
        </div>
        <div class="form-group">
          <label>关键词（可选，空格分隔）</label>
          <input v-model="newKeywords" placeholder="关键词1 关键词2" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary btn-sm" @click="showCreate = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="doCreate">创建</button>
        </div>
      </div>
    </div>

    <!-- Edit modal -->
    <div v-if="showEdit" class="overlay" @click.self="showEdit = false">
      <div class="modal">
        <h3>编辑笔记 #{{ editingNote?.id }}</h3>
        <div class="form-group">
          <label>内容</label>
          <textarea v-model="editContent"></textarea>
        </div>
        <div class="form-group">
          <label>关键词</label>
          <input v-model="editKeywords" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary btn-sm" @click="showEdit = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="doEdit">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notes-page {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}
.page-header {
  margin-bottom: 16px;
}
.page-header h2 {
  font-size: 18px;
  margin-bottom: 12px;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.search-input {
  flex: 1;
  max-width: 300px;
}
.notes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.note-card {
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.note-card:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}
.note-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}
.note-id {
  color: var(--accent);
  font-weight: 600;
}
.note-keywords {
  background: var(--bg-card);
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--warning);
}
.note-context {
  color: var(--text-muted);
}
.note-time {
  color: var(--text-muted);
  margin-left: auto;
}
.note-del {
  opacity: 0;
  transition: opacity 0.2s;
}
.note-card:hover .note-del {
  opacity: 1;
}
.note-content {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.note-expire {
  font-size: 11px;
  color: var(--warning);
  margin-top: 4px;
}
.empty-state, .loading-state {
  text-align: center;
  color: var(--text-muted);
  padding: 40px 0;
}

.form-group {
  margin-bottom: 12px;
}
.form-group label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
</style>
