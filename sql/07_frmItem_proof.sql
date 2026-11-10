-- pg-xerp port proof: frmItem — direct plpgsql round-trip via the procs
-- that crud.js (sp_frmItem_*) actually resolves. No HTTP harness in the
-- way. DO block: grid → save → re-grid → update → lock/unlock → delete.
DO $$
DECLARE
    r     record;
    v_id  bigint            := 0;
    v_sm  text              := '';
    v_upd text              := '';
    v_del text              := '';
    v_lck text              := '';
BEGIN
    RAISE NOTICE '--- 1) Grid (empty search, page 1/20) ---';
    FOR r IN SELECT * FROM public.sp_frmItem_Grid2('', 'ADMIN', 'xerp', 'xerp', 1, 20) LOOP
        RAISE NOTICE '   row Id=% Item=% rc=%', r."Id", r.det, r.rc;
    END LOOP;

    RAISE NOTICE '--- 2) DFE1 (blank add row) ---';
    FOR r IN SELECT * FROM public.sp_frmItem_DFE1(0, 'frmItem', 'ADMIN', 'xerp') LOOP
        RAISE NOTICE '   det1=%', r.det;
    END LOOP;

    RAISE NOTICE '--- 3) Boot ---';
    FOR r IN SELECT * FROM public.sp_frmItem_Boot('frmItem', 'ADMIN', 'xerp') LOOP
        RAISE NOTICE '   boot=%', r.det;
    END LOOP;

    RAISE NOTICE '--- 4) SAVE ---';
    SELECT status, id INTO v_sm, v_id FROM public.sp_frmItem_SAVE('frmItem', 'ADMIN', 'xerp', '{"Item":"RoundTripSmokePG"}') LIMIT 1;
    RAISE NOTICE '   save status=%  id=%', v_sm, v_id;

    RAISE NOTICE '--- 5) re-grid searching the saved item ---';
    FOR r IN SELECT * FROM public.sp_frmItem_Grid2('RoundTripSmokePG', 'ADMIN', 'xerp', 'xerp', 1, 20) LOOP
        RAISE NOTICE '   found Id=% Item=%', r."Id", r.det;
    END LOOP;

    RAISE NOTICE '--- 6) UPDATE ---';
    SELECT status INTO v_upd FROM public.sp_frmItem_UPDATE('frmItem', 'ADMIN', 'xerp', v_id, '{"Item":"RoundTripSmokePG-EDIT"}') LIMIT 1;
    RAISE NOTICE '   update status=%', v_upd;

    RAISE NOTICE '--- 7) LOCK/UNLOCK ---';
    SELECT status INTO v_lck FROM public.sp_frmItem_LockUnlock1(v_id, 'ADMIN', 'frmItem') LIMIT 1;
    RAISE NOTICE '   lock status=%', v_lck;

    RAISE NOTICE '--- 8) DELETE ---';
    SELECT status INTO v_del FROM public.sp_frmItem_Delete1('frmItem', 'ADMIN', 'xerp', v_id) LIMIT 1;
    RAISE NOTICE '   delete status=%', v_delILIKE;
END $$;
