import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('categories')
export class Category {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;

    @Column({ unique: true })
    slug: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'int', default: 0 })
    sortOrder: number;

    /**
     * Anidamiento por adjacency list.
     * - `parentId` es null para las categorías raíz.
     * - El frontend reconstruye el árbol; los queries con LIMIT/paginación quedan
     *   triviales (a diferencia de closure/nested set).
     */
    @Column({ type: 'uuid', nullable: true })
    @Index()
    parentId: string | null;

    @ManyToOne(() => Category, (category) => category.children, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'parentId' })
    parent: Category | null;

    @OneToMany(() => Category, (category) => category.parent)
    children: Category[];

    @OneToMany(() => Product, (product) => product.category)
    products: Product[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
