CREATE TABLE content_blocks (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  search_vector TSVECTOR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_content_blocks_search_vector ON content_blocks USING GIN (search_vector);
CREATE INDEX idx_content_blocks_user_id ON content_blocks (user_id);

CREATE OR REPLACE FUNCTION update_content_block_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.text, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_content_block_search_vector
  BEFORE INSERT OR UPDATE ON content_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_content_block_search_vector();
