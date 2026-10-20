-- Трите роли на аптеката. Пуска се след schema.sql.
-- 1) Сменете трите пароли долу (между кавичките), мин. 6 знака.
-- 2) Run. Паролата се въвежда ВЕДНЪЖ на всеки компютър при първото отваряне.
-- Пуснато повторно – само сменя паролите.

do $$
declare
  roles text[][] := array[
    ['glaven',     'glaven@apteka-zayavki.app',     'СМЕНИ-ПАРОЛА-ГЛАВЕН'],
    ['pomoshtnik', 'pomoshtnik@apteka-zayavki.app', 'СМЕНИ-ПАРОЛА-ПОМОЩНИК'],
    ['sluzhitel',  'sluzhitel@apteka-zayavki.app',  'СМЕНИ-ПАРОЛА-СЛУЖИТЕЛ']
  ];
  i int;
  uid uuid;
begin
  for i in 1 .. array_length(roles, 1) loop
    if roles[i][3] like 'СМЕНИ-%' or length(roles[i][3]) < 6 then
      raise exception 'Сменете паролата за „%“ (мин. 6 знака).', roles[i][1];
    end if;
    select id into uid from auth.users where email = roles[i][2];
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', roles[i][2],
              extensions.crypt(roles[i][3], extensions.gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text, 'email',
              jsonb_build_object('sub', uid::text, 'email', roles[i][2], 'email_verified', true), now(), now(), now());
    else
      update auth.users set encrypted_password = extensions.crypt(roles[i][3], extensions.gen_salt('bf')), updated_at = now()
      where id = uid;
    end if;
    insert into public.app_roles (user_id, role) values (uid, roles[i][1])
      on conflict (user_id) do update set role = excluded.role;
  end loop;
end $$;

select u.email, r.role from auth.users u join public.app_roles r on r.user_id = u.id order by r.role;
