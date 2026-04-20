import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../app.module';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';

async function runSeed() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);
    const configService = app.get(ConfigService);

    const email = configService.get<string>('seed.adminEmail');
    const password = configService.get<string>('seed.adminPassword');
    const name = configService.get<string>('seed.adminName');

    if (!email || !password || !name) {
        console.error('❌ Faltan variables SEED_* en .env');
        await app.close();
        process.exit(1);
    }

    const existing = await usersService.findByEmail(email);
    if (existing) {
        console.log(`ℹ️  El admin ${email} ya existe. Seed omitido.`);
        await app.close();
        return;
    }

    const admin = await usersService.create({
        email,
        password,
        name,
        role: UserRole.SUPER_ADMIN,
    });

    console.log('✅ Super Admin creado:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Nombre: ${admin.name}`);
    console.log(`   Rol: ${admin.role}`);
    console.log('');
    console.log('⚠️  Inicia sesión y cambia la contraseña inmediatamente.');

    await app.close();
}

runSeed().catch((err) => {
    console.error('❌ Error ejecutando seed:', err);
    process.exit(1);
});