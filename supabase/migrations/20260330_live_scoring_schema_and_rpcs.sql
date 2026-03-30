-- Live-scoring migration foundation for Supabase.
-- This migration introduces core tables + RPCs for gradual Firebase -> Supabase shift.

create extension if not exists pgcrypto;

create table if not exists matches (
  id uuid primary key,
  tournament_id uuid not null,
  status text default 'upcoming',
  winner text,
  result_text text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists match_score_state (
  match_id uuid primary key references matches(id) on delete cascade,
  tournament_id uuid not null,
  version bigint not null default 0,
  state jsonb not null default '{}'::jsonb,
  last_event_id bigint,
  updated_at timestamptz default now()
);

create table if not exists ball_events (
  id bigint generated always as identity primary key,
  match_id uuid not null references matches(id) on delete cascade,
  tournament_id uuid not null,
  innings_no int not null default 0,
  sequence_no int not null,
  action_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  is_undone boolean not null default false,
  created_at timestamptz default now(),
  unique (match_id, action_id),
  unique (match_id, sequence_no)
);

create table if not exists match_snapshots (
  id bigint generated always as identity primary key,
  match_id uuid not null references matches(id) on delete cascade,
  tournament_id uuid not null,
  sequence_no int not null,
  snapshot jsonb not null,
  created_at timestamptz default now(),
  unique (match_id, sequence_no)
);

create index if not exists idx_ball_events_match_seq
  on ball_events(match_id, sequence_no desc);
create index if not exists idx_ball_events_match_not_undone
  on ball_events(match_id, sequence_no desc)
  where is_undone = false;

create or replace function scoring_reduce_event(
  p_state jsonb,
  p_event_type text,
  p_payload jsonb
) returns jsonb
language plpgsql
as $$
declare
  s jsonb := coalesce(p_state, '{}'::jsonb);
  innings_idx int := coalesce((s->>'currentInnings')::int, 0);
  innings jsonb;
  arr jsonb;
begin
  if s ? 'innings' = false then
    s := jsonb_set(s, '{innings}', '[]'::jsonb, true);
  end if;

  if jsonb_array_length(s->'innings') < 2 then
    s := jsonb_set(
      s,
      '{innings}',
      jsonb_build_array(
        jsonb_build_object(
          'score',0,'wickets',0,'over',0,'overBallCount',0,
          'extras',jsonb_build_object('wides',0,'noBalls',0,'byes',0,'legByes',0),
          'timeline','[]'::jsonb,'batsmenStats','{}'::jsonb,'bowlerStats','{}'::jsonb,
          'fallOfWickets','[]'::jsonb,'awaitingNewBatsman',false,'awaitingNewBowler',false
        ),
        jsonb_build_object(
          'score',0,'wickets',0,'over',0,'overBallCount',0,
          'extras',jsonb_build_object('wides',0,'noBalls',0,'byes',0,'legByes',0),
          'timeline','[]'::jsonb,'batsmenStats','{}'::jsonb,'bowlerStats','{}'::jsonb,
          'fallOfWickets','[]'::jsonb,'awaitingNewBatsman',false,'awaitingNewBowler',false
        )
      ),
      true
    );
  end if;

  innings := (s->'innings')->innings_idx;

  if p_event_type in ('BALL','EXTRA_BALL_RUNS') then
    arr := coalesce(innings->'timeline', '[]'::jsonb) || jsonb_build_array(p_payload->'newBall');
    innings := jsonb_set(innings, '{timeline}', arr, true);

    if p_payload ? 'recalculated' then
      innings := innings || (p_payload->'recalculated');
    end if;

    s := jsonb_set(s, array['innings', innings_idx::text], innings, true);

  elsif p_event_type = 'NEW_BATSMAN' then
    if coalesce(innings->>'nonStriker','') = '' then
      innings := jsonb_set(innings, '{nonStriker}', to_jsonb(p_payload->>'player'), true);
    else
      innings := jsonb_set(innings, '{striker}', to_jsonb(p_payload->>'player'), true);
    end if;
    innings := jsonb_set(innings, '{awaitingNewBatsman}', 'false'::jsonb, true);
    s := jsonb_set(s, array['innings', innings_idx::text], innings, true);

  elsif p_event_type in ('CONFIRM_BOWLER','CHANGE_BOWLER') then
    innings := jsonb_set(innings, '{currentBowler}', to_jsonb(p_payload->>'player'), true);
    innings := jsonb_set(innings, '{awaitingNewBowler}', 'false'::jsonb, true);
    s := jsonb_set(s, array['innings', innings_idx::text], innings, true);

  elsif p_event_type = 'STRIKE_CHANGE' then
    innings := jsonb_set(innings, '{striker}', to_jsonb(p_payload->>'striker'), true);
    innings := jsonb_set(innings, '{nonStriker}', to_jsonb(p_payload->>'nonStriker'), true);
    s := jsonb_set(s, array['innings', innings_idx::text], innings, true);

  elsif p_event_type = 'END_INNINGS' then
    innings := jsonb_set(innings, '{completed}', 'true'::jsonb, true);
    s := jsonb_set(s, array['innings', innings_idx::text], innings, true);

  elsif p_event_type = 'FINISH' then
    s := jsonb_set(s, '{status}', '"finished"'::jsonb, true);
    s := jsonb_set(s, '{meta,matchStatus}', '"finished"'::jsonb, true);
    s := jsonb_set(s, '{meta,status}', '"finished"'::jsonb, true);
    if p_payload ? 'winner' then
      s := jsonb_set(s, '{winner}', to_jsonb(p_payload->>'winner'), true);
      s := jsonb_set(s, '{meta,winner}', to_jsonb(p_payload->>'winner'), true);
    end if;
    if p_payload ? 'result' then
      s := jsonb_set(s, '{meta,result}', to_jsonb(p_payload->>'result'), true);
    end if;
    if p_payload ? 'mom' then
      s := jsonb_set(s, '{meta,mom}', p_payload->'mom', true);
    end if;
  end if;

  return s;
end;
$$;

create or replace function scoring_append_ball_event(
  p_match_id uuid,
  p_tournament_id uuid,
  p_action_id text,
  p_event_type text,
  p_payload jsonb,
  p_expected_version bigint default null,
  p_actor_user_id uuid default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_state_row match_score_state%rowtype;
  v_existing_event_id bigint;
  v_next_seq int;
  v_event_id bigint;
  v_new_state jsonb;
  v_new_version bigint;
begin
  select * into v_state_row
  from match_score_state
  where match_id = p_match_id
  for update;

  if not found then
    insert into match_score_state(match_id, tournament_id, version, state)
    values (p_match_id, p_tournament_id, 0, jsonb_build_object('currentInnings',0,'innings','[]'::jsonb))
    returning * into v_state_row;
  end if;

  if p_expected_version is not null and v_state_row.version <> p_expected_version then
    raise exception 'version_mismatch expected=% got=%', p_expected_version, v_state_row.version
      using errcode = '40001';
  end if;

  select id into v_existing_event_id
  from ball_events
  where match_id = p_match_id
    and action_id = p_action_id
  limit 1;

  if v_existing_event_id is not null then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'event_id', v_existing_event_id,
      'version', v_state_row.version,
      'state', v_state_row.state
    );
  end if;

  select coalesce(max(sequence_no),0)+1 into v_next_seq
  from ball_events
  where match_id = p_match_id;

  insert into ball_events(
    match_id, tournament_id, innings_no, sequence_no,
    action_id, event_type, payload, created_by, is_undone
  )
  values(
    p_match_id,
    p_tournament_id,
    coalesce((v_state_row.state->>'currentInnings')::int,0),
    v_next_seq,
    p_action_id,
    p_event_type,
    coalesce(p_payload,'{}'::jsonb),
    p_actor_user_id,
    false
  )
  returning id into v_event_id;

  v_new_state := scoring_reduce_event(v_state_row.state, p_event_type, p_payload);
  v_new_version := v_state_row.version + 1;

  update match_score_state
  set
    version = v_new_version,
    state = v_new_state,
    last_event_id = v_event_id,
    updated_at = now()
  where match_id = p_match_id;

  if p_event_type = 'FINISH' then
    update matches
    set
      status = 'finished',
      winner = coalesce(p_payload->>'winner', winner),
      result_text = coalesce(p_payload->>'result', result_text),
      updated_at = now()
    where id = p_match_id and tournament_id = p_tournament_id;
  else
    update matches
    set updated_at = now()
    where id = p_match_id and tournament_id = p_tournament_id;
  end if;

  if (v_next_seq % 12 = 0) then
    insert into match_snapshots(match_id, tournament_id, sequence_no, snapshot)
    values (p_match_id, p_tournament_id, v_next_seq, v_new_state)
    on conflict (match_id, sequence_no) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'event_id', v_event_id,
    'sequence_no', v_next_seq,
    'version', v_new_version,
    'state', v_new_state
  );
end;
$$;

create or replace function scoring_undo_last_event(
  p_match_id uuid,
  p_tournament_id uuid,
  p_action_id text,
  p_actor_user_id uuid default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_state_row match_score_state%rowtype;
  v_target_event ball_events%rowtype;
  v_undo_event_id bigint;
  v_next_seq int;
  v_rebuild_state jsonb;
  v_new_version bigint;
begin
  select * into v_state_row
  from match_score_state
  where match_id = p_match_id
  for update;

  if not found then
    raise exception 'match_score_state missing for match %', p_match_id;
  end if;

  if exists (
    select 1 from ball_events where match_id = p_match_id and action_id = p_action_id
  ) then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'version', v_state_row.version,
      'state', v_state_row.state
    );
  end if;

  select * into v_target_event
  from ball_events
  where match_id = p_match_id
    and is_undone = false
    and event_type in ('BALL','EXTRA_BALL_RUNS','NEW_BATSMAN','CONFIRM_BOWLER','CHANGE_BOWLER','STRIKE_CHANGE','END_INNINGS')
  order by sequence_no desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'message', 'nothing_to_undo',
      'version', v_state_row.version,
      'state', v_state_row.state
    );
  end if;

  update ball_events
  set is_undone = true
  where id = v_target_event.id;

  select coalesce(max(sequence_no),0)+1 into v_next_seq
  from ball_events
  where match_id = p_match_id;

  insert into ball_events(
    match_id, tournament_id, innings_no, sequence_no,
    action_id, event_type, payload, created_by, is_undone
  )
  values(
    p_match_id,
    p_tournament_id,
    coalesce((v_state_row.state->>'currentInnings')::int,0),
    v_next_seq,
    p_action_id,
    'UNDO',
    jsonb_build_object('undone_event_id', v_target_event.id, 'undone_sequence_no', v_target_event.sequence_no),
    p_actor_user_id,
    false
  )
  returning id into v_undo_event_id;

  with snap as (
    select sequence_no, snapshot
    from match_snapshots
    where match_id = p_match_id
      and sequence_no <= v_target_event.sequence_no
    order by sequence_no desc
    limit 1
  ),
  seed as (
    select
      coalesce((select sequence_no from snap), 0) as start_seq,
      coalesce((select snapshot from snap), jsonb_build_object('currentInnings',0,'innings','[]'::jsonb)) as seed_state
  ),
  ev as (
    select e.*
    from ball_events e, seed
    where e.match_id = p_match_id
      and e.sequence_no > seed.start_seq
      and e.is_undone = false
      and e.event_type <> 'UNDO'
    order by e.sequence_no asc
  ),
  r as (
    select 0 as i, (select seed_state from seed) as s
    union all
    select
      r.i + 1,
      scoring_reduce_event(
        r.s,
        (select event_type from ev offset r.i limit 1),
        (select payload from ev offset r.i limit 1)
      )
    from r
    where exists (select 1 from ev offset r.i limit 1)
  )
  select s into v_rebuild_state
  from r
  order by i desc
  limit 1;

  v_rebuild_state := coalesce(v_rebuild_state, jsonb_build_object('currentInnings',0,'innings','[]'::jsonb));

  v_new_version := v_state_row.version + 1;

  update match_score_state
  set
    version = v_new_version,
    state = v_rebuild_state,
    last_event_id = v_undo_event_id,
    updated_at = now()
  where match_id = p_match_id;

  update matches
  set updated_at = now()
  where id = p_match_id and tournament_id = p_tournament_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'undone_event_id', v_target_event.id,
    'undo_event_id', v_undo_event_id,
    'version', v_new_version,
    'state', v_rebuild_state
  );
end;
$$;
