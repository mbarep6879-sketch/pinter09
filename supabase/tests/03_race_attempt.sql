do $x$ declare tok text; begin set local role service_role;
  tok := start_voting_session('kk_F', (select id from neighborhoods where code='RT 03'))->>'token';
  perform select_voter(tok, t.id('vF'));
  perform cast_ballots(tok,
    jsonb_build_array(jsonb_build_object('election_id', t.id('eRT3'), 'candidate_ids', jsonb_build_array(t.id('cC')))));
  raise notice 'RESULT:OK';
exception when others then raise notice 'RESULT:%', sqlerrm; end $x$;
