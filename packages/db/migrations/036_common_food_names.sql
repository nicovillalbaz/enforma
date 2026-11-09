-- Names only: no invented nutrient values, allergens, serving size or dietary advice.
-- Each independent coach owns editable copies. Existing names and edits are preserved.
CREATE FUNCTION app.seed_common_food_names(p_org uuid, p_owner uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF p_org IS NULL OR p_owner IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.organization_memberships m
   WHERE m.organization_id=p_org AND m.user_id=p_owner AND m.role='owner' AND m.status='active'
 ) THEN RAISE EXCEPTION 'INVALID_FOOD_SEED'; END IF;
 WITH catalog(n,name) AS (VALUES
  (1,'Pechuga de pollo cocida'),(2,'Muslo de pollo cocido'),(3,'Pavo cocido'),
  (4,'Huevo entero'),(5,'Clara de huevo'),(6,'Carne vacuna magra cocida'),
  (7,'Carne vacuna molida cocida'),(8,'Cerdo magro cocido'),
  (9,'Atún al natural escurrido'),(10,'Atún fresco cocido'),(11,'Salmón cocido'),
  (12,'Merluza cocida'),(13,'Sardinas en conserva escurridas'),(14,'Camarón cocido'),
  (15,'Tofu firme'),(16,'Lentejas cocidas'),(17,'Garbanzos cocidos'),
  (18,'Porotos cocidos'),(19,'Arvejas cocidas'),
  (20,'Arroz blanco cocido'),(21,'Arroz integral cocido'),(22,'Pasta cocida'),
  (23,'Avena en hojuelas'),(24,'Quinoa cocida'),(25,'Pan integral'),
  (26,'Pan blanco'),(27,'Tortilla de trigo'),(28,'Tortilla de maíz'),
  (29,'Papa cocida'),(30,'Batata cocida'),(31,'Mandioca cocida'),
  (32,'Choclo cocido'),(33,'Cuscús cocido'),(34,'Galleta de arroz'),
  (35,'Lechuga'),(36,'Tomate'),(37,'Pepino'),(38,'Zanahoria cruda'),
  (39,'Zanahoria cocida'),(40,'Cebolla'),(41,'Espinaca'),(42,'Brócoli cocido'),
  (43,'Coliflor cocida'),(44,'Repollo'),(45,'Morrón'),(46,'Zapallito'),
  (47,'Berenjena cocida'),(48,'Chauchas cocidas'),(49,'Apio'),
  (50,'Remolacha cocida'),(51,'Calabaza cocida'),(52,'Champiñones'),(53,'Palta'),
  (54,'Banana'),(55,'Manzana'),(56,'Naranja'),(57,'Mandarina'),
  (58,'Frutilla'),(59,'Arándanos'),(60,'Piña'),(61,'Mango'),
  (62,'Papaya'),(63,'Pera'),(64,'Sandía'),(65,'Uvas'),
  (66,'Leche entera'),(67,'Leche descremada'),(68,'Yogur natural'),
  (69,'Yogur griego natural'),(70,'Queso fresco'),(71,'Queso mozzarella'),
  (72,'Queso cottage'),(73,'Aceite de oliva'),(74,'Aceite de girasol'),
  (75,'Almendras'),(76,'Nueces'),(77,'Mantequilla de maní'),
  (78,'Mayonesa'),(79,'Mostaza'),(80,'Vinagre')
 ), missing AS (
  SELECT c.n,c.name,row_number() OVER (ORDER BY c.n) AS position
  FROM catalog c WHERE NOT EXISTS (
   SELECT 1 FROM public.nutrition_items i
   WHERE i.organization_id=p_org AND i.kind='food'
     AND lower(i.document->>'name')=lower(c.name)
  )
 ), capacity AS (
  SELECT greatest(0,200-count(*)) AS slots FROM public.nutrition_items
  WHERE organization_id=p_org AND kind='food'
 )
 INSERT INTO public.nutrition_items(id,organization_id,kind,document,created_by)
 SELECT md5(p_org::text||':forma-food-v1:'||lpad(m.n::text,3,'0'))::uuid,
  p_org,'food',jsonb_build_object(
   'name',m.name,
   'source','Catálogo Forma: solo nombres',
   'reference','Sin valores nutricionales; completar con fuente verificada',
   'license','Nombres comunes; sin datos de terceros',
   'checkedOn',to_char(now() AT TIME ZONE 'America/Asuncion','YYYY-MM-DD'),
   'nutrients',jsonb_build_object('kcal',NULL,'protein',NULL,'carbs',NULL,'fat',NULL),
   'allergensKnown',false,'allergens','[]'::jsonb
  ),p_owner
 FROM missing m CROSS JOIN capacity c WHERE m.position<=c.slots
 ON CONFLICT (id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION app.seed_common_food_names(uuid,uuid) FROM PUBLIC;

CREATE FUNCTION app.seed_common_food_names_on_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.role='owner' AND NEW.status='active' THEN
  PERFORM app.seed_common_food_names(NEW.organization_id,NEW.user_id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER common_food_names_on_owner AFTER INSERT ON organization_memberships
FOR EACH ROW EXECUTE FUNCTION app.seed_common_food_names_on_owner();

SELECT app.seed_common_food_names(m.organization_id,m.user_id)
FROM organization_memberships m
WHERE m.role='owner' AND m.status='active';
