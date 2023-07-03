import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenContract28 } from "../target/types/token_contract28";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createInitializeMintInstruction,
} from "@solana/spl-token";
import { assert } from "chai";

describe("token-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TokenContract28 as Program<TokenContract28>; // target/idl のjsonファイルがあってればworkspaceがある(Cargoのプログラム名とlib.rsのプログラム名があってる必要あり)

  const mintKey: anchor.web3.Keypair = anchor.web3.Keypair.generate(); //実際に作るトークンを表している
  let associatedTokenAccount = undefined;
  it("Mint a token!", async () => {
    // Add your test here.
    const key = anchor.AnchorProvider.env().wallet.publicKey;
    const lamports: number =
      await program.provider.connection.getMinimumBalanceForRentExemption(
        MINT_SIZE
      );

    //get the ATA for a token on a public key (but might not exist yet)
    associatedTokenAccount = await getAssociatedTokenAddress(
      mintKey.publicKey,
      key
    );

    const mint_tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: key,
        newAccountPubkey: mintKey.publicKey,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports,
      }),
      //fire a transacton to create our mint account that is controlled by our anchor wallet (key)
      createInitializeMintInstruction(mintKey.publicKey, 0, key, key),

      //create the ATA account that is associated with our mint on our anchor wallet (key)
      createAssociatedTokenAccountInstruction(
        key,
        associatedTokenAccount,
        key,
        mintKey.publicKey
      )
    );

    const res = await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, [
      mintKey,
    ]);

    console.log(
      await program.provider.connection.getParsedAccountInfo(mintKey.publicKey)
    );

    console.log("Account: ", res);
    console.log("Mint key: ", mintKey.publicKey.toString());
    console.log("User: ", key.toString());
    console.log("ATA", associatedTokenAccount);

    // Executes our code to mint our token into our specified ATA
    const tx = await program.methods
      .mintToken()
      .accounts({
        mint: mintKey.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenAccount: associatedTokenAccount,
        authority: key,
      })
      .rpc();

    console.log("Your transaction signature", tx);
    const minted = (
      await program.provider.connection.getParsedAccountInfo(
        associatedTokenAccount
      )
    ).value.data.parsed.info.tokenAmount.amount;
    assert.equal(minted, 10);
  });

  it("Transfer token", async () => {
    // authority of the account sending
    const myWallet = anchor.AnchorProvider.env().wallet.publicKey;
    // Account that is receiving the ATA
    const toWallet: anchor.web3.Keypair = anchor.web3.Keypair.generate();
    //get the ATA for a token on a public key (but might not exist yet)
    const toATA = await getAssociatedTokenAddress(
      mintKey.publicKey,
      toWallet.publicKey
    );

    //Fire a list of instructions
    const mint_tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        myWallet,
        toATA,
        toWallet.publicKey,
        mintKey.publicKey
      )
    );

    //sends and create the transaction
    const res = await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, []);

    console.log(res);

    // ATAのオーナーが違かったら送れない
    const tx = await program.methods
      .transferToken()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        from: associatedTokenAccount,
        fromAuthority: myWallet,
        to: toATA,
      })
      .rpc();
    console.log("Your transaction signature", tx);
    const minted = (
      await program.provider.connection.getParsedAccountInfo(
        associatedTokenAccount
      )
    ).value.data.parsed.info.tokenAmount.amount;
    assert.equal(minted, 5);
  });
});
