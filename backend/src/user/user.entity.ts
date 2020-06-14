import { Entity, PrimaryGeneratedColumn, Column, Generated, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import {IsEmail, IsOptional} from 'class-validator';
import * as bcrypt from 'bcrypt';

export class User {

  // How long we wait for the user to click confirmation email when creating a new account
  static EMAIL_CONFIRMATION_TIMEOUT_SECONDS = 3*24*3600;

  // How many times we rerun hasher to make password cracking slower
  static SALT_ROUNDS = 10;

  // This is what we use internally as a foreign key, but never expose to the public because leaking user counts is
  // a company trade secrets issue
  // (Running counter keys make data more local and faster to access)
  @PrimaryGeneratedColumn()
  id: number;

  // Nice columns for internal statistics and diagnostics
  // We assume all servers tick UTC, but we always preserve timezone for
  // our sanity when something gets messy
  @CreateDateColumn({ type: 'timestamptz', name: 'create_date', default: () => 'LOCALTIMESTAMP' })
  createdAt: Date;

  // Nice columns for internal statistics and diagnostics
  @UpdateDateColumn({ type: 'timestamptz', name: 'update_date', default: () => 'LOCALTIMESTAMP' })
  updatedAt: Date;

  // Already refer users by this id when in the APIs .
  // (Randomized public ids make data exposure safer)
  @Column({unique: true})
  @Generated("uuid")
  publicId: string;

  // User's chosen nick, settable by the user
  @Column({length: 50, unique: true})
  displayName: string;

  // Set after the email verification completes
  @Column({length: 50, nullable: true, unique: true})
  @IsOptional()
  @IsEmail()
  confirmedEmail: string;

  // Set on the sign up / email change
  @Column({length: 50, nullable: false})
  @IsEmail()
  pendingEmail: string;

  // Set after the email verification completes
  @Column({length: 16, nullable: true, unique: true})
  emailConfirmationToken: string;

  // When the user registerd / requested email change
  @Column({ type: 'timestamptz', nullable: false })
  emailConfirmationRequestedAt: Date;

  // When the user registerd / requested email change
  @Column({ type: 'timestamptz', nullable: true})
  emailConfirmationCompletedAt: Date;

  // Set when user resets password, when user is forcefully banned, etc.
  // If securityOperationPerformedAt > session created at, terminate the user session
  @Column({ type: 'timestamptz', nullable: true})
  securityOperationPerformedAt: Date;

  // A hashed password - can be null for users created from OAuth sourced like Facebook
  @Column({select: false, nullable: true })
  passwordHash: string;

  // Can this user login - the email registratoin is valid
  canLogIn(): boolean {
      return this.emailConfirmationCompletedAt != null;
  }

  async resetPassword(newPassword: string): Promise<void> {
    // https://www.npmjs.com/package/bcrypt#with-promises
    const hash = await bcrypt.hash(newPassword, User.SALT_ROUNDS)
    this.passwordHash = hash;
    // Force user log out
    this.securityOperationPerformedAt = new Date();
  }

  async isRightPassword(password: string): Promise<boolean> {
    const match = await bcrypt.compare(password, this.passwordHash);
    return match;
  }

}