-- Body regions are descriptive catalog metadata, not technique or a prescription.
-- Reference for broad target regions: ACE Exercise Library, https://www.acefitness.org/resources/everyone/exercise-library/
WITH regions(n, primary_region, secondary_region, area_tag, secondary_tag) AS (VALUES
 (1,'pectorales','tríceps y hombros anteriores','Pecho','Tríceps'),
 (2,'pectorales','tríceps y hombros anteriores','Pecho','Tríceps'),
 (3,'pectorales','tríceps y hombros anteriores','Pecho','Tríceps'),
 (4,'pectorales','tríceps y hombros anteriores','Pecho','Tríceps'),
 (5,'pectorales','tríceps y hombros anteriores','Pecho','Tríceps'),
 (6,'pectorales','hombros anteriores','Pecho','Hombros'),
 (7,'pectorales','hombros anteriores','Pecho','Hombros'),
 (8,'pectorales','tríceps, hombros anteriores y zona media','Pecho','Tríceps'),
 (9,'pectorales y tríceps','hombros anteriores','Pecho','Tríceps'),
 (10,'espalda media y dorsal ancho','bíceps y hombros posteriores','Espalda','Bíceps'),
 (11,'espalda media y dorsal ancho','bíceps y hombros posteriores','Espalda','Bíceps'),
 (12,'espalda media y dorsal ancho','bíceps y hombros posteriores','Espalda','Bíceps'),
 (13,'espalda media y dorsal ancho','bíceps y hombros posteriores','Espalda','Bíceps'),
 (14,'dorsal ancho y espalda alta','bíceps','Espalda','Bíceps'),
 (15,'dorsal ancho y espalda alta','bíceps','Espalda','Bíceps'),
 (16,'dorsal ancho y espalda alta','bíceps','Espalda','Bíceps'),
 (17,'glúteos y muslos','espalda baja y zona media','Piernas','Glúteos'),
 (18,'isquiotibiales y glúteos','espalda baja','Piernas','Glúteos'),
 (19,'glúteos y muslos','espalda baja y zona media','Piernas','Glúteos'),
 (20,'cuádriceps y glúteos','zona media','Piernas','Glúteos'),
 (21,'cuádriceps y glúteos','zona media','Piernas','Glúteos'),
 (22,'cuádriceps y glúteos','zona media','Piernas','Glúteos'),
 (23,'cuádriceps y glúteos','isquiotibiales y zona media','Piernas','Glúteos'),
 (24,'cuádriceps y glúteos','isquiotibiales y zona media','Piernas','Glúteos'),
 (25,'cuádriceps y glúteos','isquiotibiales y zona media','Piernas','Glúteos'),
 (26,'cuádriceps y glúteos','isquiotibiales y zona media','Piernas','Glúteos'),
 (27,'cuádriceps y glúteos','isquiotibiales','Piernas','Glúteos'),
 (28,'cuádriceps','muslos anteriores','Piernas','Cuádriceps'),
 (29,'isquiotibiales','muslos posteriores','Piernas','Isquiotibiales'),
 (30,'isquiotibiales','muslos posteriores','Piernas','Isquiotibiales'),
 (31,'pantorrillas','músculos de la pierna inferior','Piernas','Pantorrillas'),
 (32,'pantorrillas','músculos de la pierna inferior','Piernas','Pantorrillas'),
 (33,'glúteos','isquiotibiales','Piernas','Glúteos'),
 (34,'glúteos','isquiotibiales','Piernas','Glúteos'),
 (35,'hombros','tríceps y zona media','Hombros','Tríceps'),
 (36,'hombros','tríceps y zona media','Hombros','Tríceps'),
 (37,'hombros','tríceps','Hombros','Tríceps'),
 (38,'parte lateral de los hombros','parte superior de los brazos','Hombros','Deltoides'),
 (39,'parte lateral de los hombros','parte superior de los brazos','Hombros','Deltoides'),
 (40,'bíceps','antebrazos','Brazos','Bíceps'),
 (41,'bíceps','antebrazos','Brazos','Bíceps'),
 (42,'bíceps y braquial','antebrazos','Brazos','Bíceps'),
 (43,'tríceps','parte posterior de los brazos','Brazos','Tríceps'),
 (44,'tríceps','parte posterior de los brazos','Brazos','Tríceps'),
 (45,'tríceps','pectorales y hombros anteriores','Brazos','Tríceps'),
 (46,'zona abdominal','hombros y glúteos como estabilizadores','Zona media','Abdomen'),
 (47,'zona abdominal','músculos de la zona media','Zona media','Abdomen'),
 (48,'zona abdominal','músculos de la zona media','Zona media','Abdomen'),
 (49,'sistema cardiovascular y piernas','glúteos y zona media','Cardio','Piernas'),
 (50,'sistema cardiovascular y piernas','glúteos','Cardio','Piernas'),
 (51,'sistema cardiovascular y piernas','glúteos y brazos','Cardio','Piernas'),
 (52,'sistema cardiovascular y pantorrillas','hombros y antebrazos','Cardio','Pantorrillas')
)
UPDATE exercises AS e SET
 instructions = 'Zonas trabajadas: ' || r.primary_region || '. También participan: ' || r.secondary_region || '.',
 tags = ARRAY[r.area_tag, r.secondary_tag],
 updated_at = now()
FROM regions AS r
WHERE e.id = ('62000000-0000-4000-8000-' || lpad(r.n::text,12,'0'))::uuid
  AND e.organization_id IS NULL;

WITH regions(id, area, detail, secondary) AS (VALUES
 ('61000000-0000-4000-8000-000000000001'::uuid,'Piernas','cuádriceps y glúteos','Glúteos'),
 ('61000000-0000-4000-8000-000000000002'::uuid,'Espalda','espalda media, dorsal ancho y bíceps','Bíceps'),
 ('61000000-0000-4000-8000-000000000003'::uuid,'Zona media','zona abdominal; hombros y glúteos estabilizan','Abdomen'),
 ('61000000-0000-4000-8000-000000000004'::uuid,'Cardio','sistema cardiovascular y piernas','Piernas')
)
UPDATE exercises AS e SET
 instructions = 'Zonas trabajadas: ' || r.detail || E'.\n\n' || e.instructions,
 tags = ARRAY[r.area, r.secondary],
 updated_at = now()
FROM regions AS r
WHERE e.id = r.id AND e.organization_id IS NULL;
