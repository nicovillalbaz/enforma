-- Original Forma diagrams and a neutral starting index. No third-party media or technique claims.
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_visual_key_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_visual_key_check CHECK (
 visual_key IS NULL OR visual_key IN (
  'bench','squat','hinge','row','overhead','lunge','pullup','curl','pulldown','plank','bike',
  'pushup','fly','dip','legpress','legextension','legcurl','hipthrust','calf','lateralraise',
  'triceps','crunch','rope','treadmill','elliptical'
 )
);

UPDATE exercises SET visual_key=CASE id
 WHEN '61000000-0000-4000-8000-000000000001' THEN 'squat'
 WHEN '61000000-0000-4000-8000-000000000002' THEN 'row'
 WHEN '61000000-0000-4000-8000-000000000003' THEN 'plank'
 WHEN '61000000-0000-4000-8000-000000000004' THEN 'treadmill'
 END
WHERE id IN (
 '61000000-0000-4000-8000-000000000001',
 '61000000-0000-4000-8000-000000000002',
 '61000000-0000-4000-8000-000000000003',
 '61000000-0000-4000-8000-000000000004'
) AND visual_key IS NULL;

WITH catalog(n,name,muscle,equipment_tag,metric,visual_key) AS (VALUES
 (1,'Press de banca con barra','Pecho','Barra y banco','reps','bench'),
 (2,'Press de banca con mancuernas','Pecho','Mancuernas y banco','reps','bench'),
 (3,'Press inclinado con barra','Pecho','Barra y banco inclinado','reps','bench'),
 (4,'Press inclinado con mancuernas','Pecho','Mancuernas y banco inclinado','reps','bench'),
 (5,'Press de pecho en máquina','Pecho','Máquina de pecho','reps','bench'),
 (6,'Aperturas con mancuernas','Pecho','Mancuernas y banco','reps','fly'),
 (7,'Aperturas en polea','Pecho','Poleas','reps','fly'),
 (8,'Flexiones de brazos','Pecho','Peso corporal','reps','pushup'),
 (9,'Fondos en paralelas','Pecho','Paralelas','reps','dip'),
 (10,'Remo con barra','Espalda','Barra','reps','row'),
 (11,'Remo con mancuerna','Espalda','Mancuerna y banco','reps','row'),
 (12,'Remo en máquina','Espalda','Máquina de remo','reps','row'),
 (13,'Remo en polea baja','Espalda','Polea','reps','row'),
 (14,'Jalón al pecho','Espalda','Polea alta','reps','pulldown'),
 (15,'Dominadas','Espalda','Barra fija','reps','pullup'),
 (16,'Dominadas asistidas','Espalda','Máquina asistida','reps','pullup'),
 (17,'Peso muerto convencional','Piernas','Barra','reps','hinge'),
 (18,'Peso muerto rumano','Piernas','Barra o mancuernas','reps','hinge'),
 (19,'Peso muerto sumo','Piernas','Barra','reps','hinge'),
 (20,'Sentadilla con barra','Piernas','Barra','reps','squat'),
 (21,'Sentadilla goblet','Piernas','Mancuerna o pesa rusa','reps','squat'),
 (22,'Sentadilla frontal','Piernas','Barra','reps','squat'),
 (23,'Sentadilla búlgara','Piernas','Banco','reps','lunge'),
 (24,'Zancadas caminando','Piernas','Peso corporal o mancuernas','reps','lunge'),
 (25,'Zancadas hacia atrás','Piernas','Peso corporal o mancuernas','reps','lunge'),
 (26,'Subida al banco','Piernas','Banco o cajón','reps','lunge'),
 (27,'Prensa de piernas','Piernas','Prensa','reps','legpress'),
 (28,'Extensión de piernas','Piernas','Máquina de extensión','reps','legextension'),
 (29,'Curl femoral tumbado','Piernas','Máquina de curl','reps','legcurl'),
 (30,'Curl femoral sentado','Piernas','Máquina de curl','reps','legcurl'),
 (31,'Elevación de talones de pie','Piernas','Máquina o peso corporal','reps','calf'),
 (32,'Elevación de talones sentado','Piernas','Máquina o banco','reps','calf'),
 (33,'Empuje de cadera con barra','Piernas','Barra y banco','reps','hipthrust'),
 (34,'Puente de glúteos','Piernas','Peso corporal','reps','hipthrust'),
 (35,'Press militar con barra','Hombros','Barra','reps','overhead'),
 (36,'Press de hombros con mancuernas','Hombros','Mancuernas','reps','overhead'),
 (37,'Press de hombros en máquina','Hombros','Máquina de hombros','reps','overhead'),
 (38,'Elevaciones laterales con mancuernas','Hombros','Mancuernas','reps','lateralraise'),
 (39,'Elevaciones laterales en polea','Hombros','Polea','reps','lateralraise'),
 (40,'Curl de bíceps con barra','Brazos','Barra','reps','curl'),
 (41,'Curl de bíceps con mancuernas','Brazos','Mancuernas','reps','curl'),
 (42,'Curl martillo','Brazos','Mancuernas','reps','curl'),
 (43,'Extensión de tríceps en polea','Brazos','Polea','reps','triceps'),
 (44,'Extensión de tríceps con mancuerna','Brazos','Mancuerna','reps','triceps'),
 (45,'Fondos en banco','Brazos','Banco','reps','dip'),
 (46,'Plancha frontal','Zona media','Peso corporal','time','plank'),
 (47,'Crunch abdominal','Zona media','Colchoneta','reps','crunch'),
 (48,'Crunch en máquina','Zona media','Máquina abdominal','reps','crunch'),
 (49,'Cinta de correr','Cardio','Cinta','time','treadmill'),
 (50,'Bicicleta estática','Cardio','Bicicleta','time','bike'),
 (51,'Elíptica','Cardio','Elíptica','time','elliptical'),
 (52,'Saltar cuerda','Cardio','Cuerda','time','rope')
)
INSERT INTO exercises(id,name,instructions,muscle,equipment_tag,metric,state,tags,visual_key)
SELECT ('62000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 name,
 'Sigue las indicaciones específicas de tu coach para este ejercicio. El coach define la preparación, el recorrido, la carga y las adaptaciones.',
 muscle,equipment_tag,metric,'published',ARRAY['Referencia visual'],visual_key
FROM catalog
ON CONFLICT (id) DO NOTHING;
