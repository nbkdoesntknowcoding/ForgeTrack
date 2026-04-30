import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lgbzuqjkkazurbedoizp.supabase.co';
const supabaseAnonKey = 'sb_publishable_duIAxgQgVmd9RMxArQiE-Q_Gt8Ildnk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignUp(email, password) {
    console.log(`Testing sign up for ${email}`);
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });

    if (error) {
        console.error(`Error: ${error.message} (status: ${error.status})`);
    } else {
        console.log(`Success! User ID: ${data.user.id}`);
    }
}

(async () => {
    await testSignUp('test_' + Date.now() + '@example.com', 'password123');
})();
