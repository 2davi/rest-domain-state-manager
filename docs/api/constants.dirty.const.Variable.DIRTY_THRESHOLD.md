# Variable: DIRTY\_THRESHOLD

> `const` `readonly` **DIRTY\_THRESHOLD**: `number` = `0.7`

DIRTY_THRESHOLD : PUT/PATCH 자동 분기 임계값

`dirtyFields.size / totalFields` 가 이 값 이상이면 PUT,
미만이면 PATCH로 분기한다.
