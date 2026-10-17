-- A phone identifies exactly one login, including across owner/supplier and staff tables.
CREATE FUNCTION public.guard_login_phone()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.phone IS NULL OR (TG_OP='UPDATE' AND NEW.phone IS NOT DISTINCT FROM OLD.phone) THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('login-phone:'||NEW.phone,0));
  IF (TG_TABLE_NAME='users' AND EXISTS(SELECT 1 FROM staff_members WHERE phone=NEW.phone))
     OR (TG_TABLE_NAME='staff_members' AND EXISTS(SELECT 1 FROM users WHERE phone=NEW.phone)) THEN
    RAISE EXCEPTION 'This phone number already belongs to another Uzuri Living login' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_login_phone BEFORE INSERT OR UPDATE OF phone ON public.users FOR EACH ROW EXECUTE FUNCTION public.guard_login_phone();
CREATE TRIGGER staff_login_phone BEFORE INSERT OR UPDATE OF phone ON public.staff_members FOR EACH ROW EXECUTE FUNCTION public.guard_login_phone();

CREATE FUNCTION public.register_shop_account(p_body JSONB,p_pin_hash TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE user_id TEXT:=gen_random_uuid()::TEXT; name_value TEXT:=BTRIM(p_body->>'name'); role_value TEXT:=p_body->>'role';
BEGIN
  IF role_value NOT IN ('MERCHANT','SUPPLIER') OR COALESCE(name_value,'')='' OR COALESCE(p_pin_hash,'')='' THEN
    RAISE EXCEPTION 'Invalid registration' USING ERRCODE='22023';
  END IF;
  INSERT INTO users(id,phone,pin,name,role,"approvalStatus","updatedAt")
    VALUES(user_id,p_body->>'phone',p_pin_hash,name_value,role_value::"Role",'PENDING',NOW());
  IF role_value='MERCHANT' THEN
    INSERT INTO shops(id,"userId",name,location,district,category,"trialEndsAt","updatedAt")
      VALUES(gen_random_uuid()::TEXT,user_id,COALESCE(NULLIF(BTRIM(p_body->>'shopName'),''),name_value||'''s Shop'),
        COALESCE(NULLIF(BTRIM(p_body->>'shopLocation'),''),'Dar es Salaam'),NULLIF(BTRIM(p_body->>'shopDistrict'),''),
        COALESCE(NULLIF(BTRIM(p_body->>'shopCategory'),''),'general'),NOW()+INTERVAL '14 days',NOW());
  ELSE
    INSERT INTO suppliers(id,"userId",name,phone,"updatedAt") VALUES(gen_random_uuid()::TEXT,user_id,name_value,p_body->>'phone',NOW());
  END IF;
  RETURN user_id;
END $$;
REVOKE ALL ON FUNCTION public.guard_login_phone(),public.register_shop_account(JSONB,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_shop_account(JSONB,TEXT) TO service_role;
