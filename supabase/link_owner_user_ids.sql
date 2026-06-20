-- user_roles に登録済みの auth.users と email で照合し、user_id が NULL の owners を更新
UPDATE owners o
SET user_id = u.id
FROM auth.users u
INNER JOIN user_roles ur ON ur.user_id = u.id
WHERE o.user_id IS NULL
  AND o.email = u.email
  AND ur.role = 'owner';

-- 更新結果の確認（0件になれば全て紐づけ済み）
SELECT id, email, user_id FROM owners WHERE user_id IS NULL;
