-- Create the trigger for auto-creating profiles on new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users that don't have one
INSERT INTO public.profiles (user_id, name)
SELECT au.id, COALESCE(au.raw_user_meta_data->>'name', '')
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.id IS NULL;