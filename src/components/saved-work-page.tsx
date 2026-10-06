'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, Plus } from 'lucide-react';
import { Button, Dialog, StatusLabel } from './ui';
import { useWork } from './work-provider';
import { SavedTaskEditor } from './saved-task-editor';
import { localToday, workDate, type WorkBoard, type WorkGroup, type WorkTask } from '@/lib/work';
import './auth.css';
import './saved-work.css';

type FormCache = { edit: Edit; values: Record<string,string> };
function formKey(edit:Edit) { return edit.kind==='board' ? `form:board:${edit.board?.id??'new'}` : edit.kind==='group' ? `form:group:${edit.group?.id??edit.boardId}` : `form:task:${edit.boardId}:${edit.groupId}:${edit.parentId??''}`; }
type Edit = ({ kind: 'board'; board?: WorkBoard } | { kind: 'group'; boardId: string; group?: WorkGroup } | { kind: 'task'; boardId: string; groupId: string; parentId?: string }) & { creationId?: string };
export function SavedWorkPage({ section, boardId }: { section: 'home' | 'boards'; boardId?: string }) {
  const work = useWork();
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const selectedId = params.get('task');
  const [edit, setEdit] = useState<Edit | null>(null);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [version, setVersion] = useState(0);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (work.error && !selectedId && !edit) errorRef.current?.focus(); }, [work.error,selectedId,edit]);
  const data = work.data;
  const canEdit = Boolean(data && data.actor.role !== 'viewer');
  const board = data?.boards.find(item => item.id === boardId);
  const selected = data?.tasks.find(task => task.id === selectedId);
  function taskHref(task: WorkTask) { const search = new URLSearchParams(params); search.set('task',task.id); return `${pathname}?${search}`; }
  function leave() {
    if(selectedId)work.setDraft(`task:${selectedId}`,null);
    if(edit)work.setDraft(formKey(edit),null);
    setDirty(false); setDiscard(false); setEdit(null); work.clearError();
    if (selectedId) { const search = new URLSearchParams(params); search.delete('task'); router.replace(`${pathname}${search.size ? `?${search}` : ''}`,{scroll:false}); }
  }
  function close() { if(work.pending) return; if(discard) setDiscard(false); else if(dirty) setDiscard(true); else leave(); }
  function openEdit(next: Edit) { work.clearError(); setDirty(Boolean(work.drafts[formKey(next)])); setDiscard(false); setVersion(value=>value+1); const restored=(work.drafts[formKey(next)] as FormCache|undefined)?.edit??next; setEdit({...restored,creationId:restored.creationId??crypto.randomUUID()}); }
  async function reloadTask() { if (await work.refresh()) { if(selectedId)work.setDraft(`task:${selectedId}`,null); setDirty(false); setVersion(value=>value+1); } }
  function tasksList(tasks: WorkTask[]) {
    return <ul className="saved-task-list">{tasks.map(task=><li key={task.id} className={task.parentId ? 'saved-task saved-task--child':'saved-task'}>
      <Link href={taskHref(task)} scroll={false} className="saved-task-title" onClick={()=>{work.clearError();setDirty(false);}}><strong>{task.title}</strong>{work.drafts[`task:${task.id}`] ? <span>Unsaved draft in this tab</span>:null}<span>{task.parentId ? `Subtask of ${data?.tasks.find(parent=>parent.id===task.parentId)?.title ?? 'another task'}` : data?.boards.find(item=>item.id===task.boardId)?.name}</span></Link>
      <StatusLabel status={task.status} /><span className="saved-task-meta">{task.priority} priority<br/>{workDate(task.dueDate)}</span>
      <span className="saved-task-people">{task.assigneeIds.map(id=>data?.members.find(member=>member.id===id)?.name).filter(Boolean).join(', ') || 'Unassigned'}</span>
    </li>)}</ul>;
  }
  function boardsList() {
    return data?.boards.length ? <div className="project-grid">{data.boards.map(item=><Link key={item.id} className="project-card" href={`/boards/${item.id}`}><div className="project-card__top"><LayoutGrid size={24} aria-hidden="true" /></div><h2>{item.name}</h2><p>{item.description || 'A shared board for your team.'}</p><span className="section-count">{data.tasks.filter(task=>task.boardId===item.id && !task.parentId).length} tasks</span></Link>)}</div> : <div className="saved-empty"><h2>No boards yet</h2><p>{canEdit ? 'Create your first board to start saving work for the team.' : 'An owner or editor can create the first board. You’ll be able to read it here.'}</p>{canEdit ? <Button variant="primary" onClick={()=>openEdit({kind:'board'})}>Create first board</Button>:null}</div>;
  }
  if (!data) return <section><h1>{section==='home'?'Your workspace':'Boards'}</h1><p className="page-description" role={work.error?'alert':'status'}>{work.error || 'Loading saved work…'}</p>{work.error ? <div className="saved-actions"><Button onClick={()=>void work.refresh()}>Retry</Button><Link className="text-link" href="/sign-in">Sign in</Link></div>:null}</section>;
  const boardGroups = data.groups.filter(group=>group.boardId===boardId).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  const boardTasks = data.tasks.filter(task=>task.boardId===boardId).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  const mine = data.tasks.filter(task=>task.assigneeIds.includes(data.actor.id)&&task.status!=='Done');
  const today=localToday();
  const buckets=[['Overdue',mine.filter(task=>task.dueDate && task.dueDate<today)],['Today',mine.filter(task=>task.dueDate===today)],['Upcoming',mine.filter(task=>task.dueDate && task.dueDate>today)],['Without a date',mine.filter(task=>!task.dueDate)]] as const;
  return <section className="saved-work">
    <div className="page-heading"><div><h1>{section==='home' ? `Welcome back, ${data.actor.name.split(' ')[0]}.` : boardId ? board?.name || 'Board not found' : 'Boards'}</h1><p className="page-description">{section==='home' ? 'Your assigned work and the team’s shared boards.' : boardId ? board?.description : 'Shared projects, saved in your workspace.'}</p></div><div className="saved-actions"><Button disabled={work.pending||work.loading} onClick={()=>void work.refresh()}>{work.loading?'Refreshing…':'Refresh'}</Button>{canEdit && !boardId ? <Button variant="primary" onClick={()=>openEdit({kind:'board'})}><Plus size={18} aria-hidden="true"/>New board</Button>:null}{canEdit && board ? <Button onClick={()=>openEdit({kind:'board',board})}>Edit board</Button>:null}</div></div>
    {Object.entries(work.drafts).filter(([key])=>key.startsWith('form:')).map(([key,value])=><p key={key} className="saved-draft-note">Unsaved {((value as FormCache).edit.kind)} input is kept in this tab. <Button variant="ghost" onClick={()=>openEdit((value as FormCache).edit)}>Resume draft</Button></p>)}
    <p className="saved-scope">{canEdit ? 'Use Save to keep changes. Work is shared with your team.' : 'Viewer access · you can read shared work. Ask an owner for editing access.'}</p>
    <p role="status" className="saved-notice">{work.pending?'Saving…':work.notice}</p>
    {work.error && !selectedId && !edit ? <div className="saved-feedback"><p ref={errorRef} tabIndex={-1} role="alert" className="auth-error">{work.error}</p><Button onClick={()=>void work.refresh()}>Reload saved work</Button></div>:null}
    {section==='home' ? <><section className="saved-section"><h2>My Day</h2>{mine.length ? buckets.filter(([,tasks])=>tasks.length).map(([name,tasks])=><section key={name} className="saved-group"><h3>{name}</h3>{tasksList(tasks)}</section>) : <p className="page-description">No open tasks are assigned to you.</p>}</section><section className="saved-section"><h2>Shared boards</h2>{boardsList()}</section></> : !boardId ? boardsList() : board ? <><Link href="/boards" className="back-link">All boards</Link>{boardGroups.map(group=><section key={group.id} className="saved-group"><header className="saved-group-heading"><h2>{group.name}</h2>{canEdit ? <Button variant="ghost" onClick={()=>openEdit({kind:'group',boardId:board.id,group})}>Edit {group.name} group</Button>:null}</header>{boardTasks.some(task=>task.groupId===group.id) ? tasksList(boardTasks.filter(task=>task.groupId===group.id)) : <p className="saved-empty-row">No tasks in this group.</p>}{canEdit ? <Button className="saved-add-task" variant="ghost" onClick={()=>openEdit({kind:'task',boardId:board.id,groupId:group.id})}><Plus size={18} aria-hidden="true"/>Add task to {group.name}</Button>:null}</section>)}{canEdit ? <Button onClick={()=>openEdit({kind:'group',boardId:board.id})}>Add group</Button>:null}</> : <p className="page-description">This board is unavailable in your workspace. <Link href="/boards" className="text-link">Back to boards</Link></p>}
    <Dialog open={Boolean(edit||selectedId)} onClose={close} title={discard?'Discard unsaved changes?':edit ? edit.kind==='board' ? edit.board?'Edit board':'New board':edit.kind==='group'?edit.group?'Edit group':'New group':'New task':'Task details'} className="saved-work-dialog">
      {discard ? <div><p className="dialog-intro">Your unsaved input will be discarded. Saved work will stay unchanged.</p><div className="saved-actions"><Button onClick={()=>setDiscard(false)}>Keep editing</Button><Button onClick={leave}>Discard changes</Button></div></div>:null}
      <div hidden={discard}>
        {edit ? <WorkForm key={`${edit.kind}-${version}`} edit={edit} pending={work.pending} error={work.error} conflict={work.conflict} save={work.save} close={close} saved={leave} dirty={()=>setDirty(true)}/> : selected ? <>
          <SavedTaskEditor key={`${selected.id}-${version}`} task={selected} groups={data.groups} tasks={data.tasks} members={data.members} canEdit={canEdit} save={work.save} pending={work.pending} error={work.error} close={close} saved={leave} reload={()=>void reloadTask()} onDirtyChange={setDirty}/>
          <section className="saved-subtasks"><h3>Subtasks</h3>{data.tasks.filter(task=>task.parentId===selected.id).map(task=><p key={task.id}><Link href={taskHref(task)} scroll={false} className="text-link" onClick={()=>{work.clearError();setDirty(false);setVersion(value=>value+1);}}>{task.title}</Link></p>)}{canEdit ? <Button disabled={dirty||work.pending} onClick={()=>{const next={kind:'task' as const,boardId:selected.boardId,groupId:selected.groupId,parentId:selected.id};const search=new URLSearchParams(params);search.delete('task');router.replace(`${pathname}${search.size?`?${search}`:''}`,{scroll:false});openEdit(next);}}>Add subtask</Button>:null}{dirty ? <p className="auth-hint">Save or cancel your edits before adding a subtask.</p>:null}</section>
        </> : selectedId ? <p>This task is unavailable. Close this panel and refresh the workspace.</p> : null}
      </div>
    </Dialog>
  </section>;
}

function WorkForm({edit,pending,error,conflict,save,close,saved,dirty}:{edit:Edit;pending:boolean;error:string;conflict:boolean;save:(payload:object)=>Promise<boolean>;close:()=>void;saved:()=>void;dirty:()=>void}) {
  const {drafts,setDraft}=useWork();
  const cached=drafts[formKey(edit)] as FormCache|undefined;
  const errorRef=useRef<HTMLParagraphElement>(null);
  function keepForm(event:FormEvent<HTMLFormElement>) { dirty(); const values=Object.fromEntries([...new FormData(event.currentTarget)].map(([key,value])=>[key,String(value)])); setDraft(formKey(edit),{edit,values}); }
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=new FormData(event.currentTarget); let payload:object;
    if(edit.kind==='board') payload={action:edit.board?'updateBoard':'createBoard',...(edit.board?{id:edit.board.id,revision:edit.board.revision}:{}),name:String(form.get('name')).trim(),description:String(form.get('description')??'')};
    else if(edit.kind==='group') payload={action:edit.group?'updateGroup':'createGroup',...(edit.group?{id:edit.group.id,revision:edit.group.revision,position:Number(form.get('position'))}:{boardId:edit.boardId}),name:String(form.get('name')).trim()};
    else payload={action:'createTask',boardId:edit.boardId,groupId:edit.groupId,title:String(form.get('name')).trim(),...(edit.parentId?{parentId:edit.parentId}:{})};
    if(await save({...payload,...((edit.kind==='task'||(edit.kind==='board'&&!edit.board)||(edit.kind==='group'&&!edit.group))&&edit.creationId?{creationId:edit.creationId}:{})})) saved();
  }
  const current=edit.kind==='board'?edit.board:edit.kind==='group'?edit.group:undefined;
  return <form className="saved-form" onSubmit={submit} onChange={keepForm} aria-busy={pending}>
    <label className="auth-field" htmlFor="work-name">{edit.kind==='task'?'Task title':'Name'}<input id="work-name" name="name" required maxLength={edit.kind==='task'?240:120} defaultValue={cached?.values.name??current?.name??''} readOnly={pending} autoComplete="off" /></label>
    {edit.kind==='board'?<label className="auth-field" htmlFor="work-description">Description<textarea id="work-description" name="description" maxLength={4000} defaultValue={cached?.values.description??edit.board?.description??''} readOnly={pending} rows={3}/></label>:null}
    {edit.kind==='group'&&edit.group?<label className="auth-field" htmlFor="work-position">Order<input id="work-position" name="position" type="number" min={0} max={2147483646} step={1} required defaultValue={cached?.values.position??edit.group.position} readOnly={pending}/><span className="auth-hint">Lower numbers appear first.</span></label>:null}
    {error?<p ref={errorRef} tabIndex={-1} role="alert" className="auth-error">{error}</p>:null}
    {conflict?<p className="auth-hint">Your input is still here. Copy anything you need, cancel this form, refresh the workspace and reopen it to edit the latest version.</p>:null}
    <div className="saved-actions"><Button type="submit" variant="primary" disabled={pending}>{pending?'Saving…':'Save'}</Button><Button onClick={close} disabled={pending}>Cancel</Button></div>
  </form>;
}
