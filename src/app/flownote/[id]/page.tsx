import FlowNoteApp from '../components/FlowNoteApp';
import { use } from 'react';

export default function FlowNoteIdPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return <FlowNoteApp key={params.id} flownoteId={params.id} />;
}
