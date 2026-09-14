-- Quién ejecuta el cierre de una etapa (bache) o de un turno (envasado)
-- queda registrado como "firma" de ese cierre -- distinto de la firma de
-- calidad (que es una aprobación aparte, posterior). Así los supervisores
-- también aparecen firmando cuando cierran una etapa/turno, no solo quien
-- fue elegido como operario responsable al inicio.
alter table bache_stage_records add column closed_by uuid references profiles(id);
alter table envasado_cortes add column closed_by uuid references profiles(id);
