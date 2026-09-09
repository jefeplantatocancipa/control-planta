-- finalizarEnvasado insertaba el encajado sin revisar si fallaba (ver
-- fix en el codigo), asi que algunos envasados ya finalizados se quedaron
-- sin su encajado. Se rellenan acá los que falten.
insert into encajados (envasado_id, bache_id, created_by)
select e.id, e.bache_id, e.created_by
from envasados e
where e.ended_at is not null
  and not exists (
    select 1 from encajados en where en.envasado_id = e.id
  );
