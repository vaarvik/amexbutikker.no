import type { ClassDeclaration, ClassExpression, Type } from 'ts-morph';

/** Answers questions about a class's inheritance chain. */
export interface ClassHeritage {
  /** True when the class, or any base class in the project, has an `implements` clause. */
  implementsAnInterface(node: ClassDeclaration | ClassExpression): boolean;
  /** True when the class extends the built-in `Error`, directly or through base classes. */
  extendsError(node: ClassDeclaration | ClassExpression): boolean;
}

export class TypeCheckerClassHeritage implements ClassHeritage {
  public implementsAnInterface(node: ClassDeclaration | ClassExpression): boolean {
    let current: ClassDeclaration | ClassExpression | undefined = node;
    const seen = new Set<ClassDeclaration | ClassExpression>();
    while (current !== undefined && !seen.has(current)) {
      if (current.getImplements().length > 0) {
        return true;
      }
      seen.add(current);
      current = current.getBaseClass();
    }
    return false;
  }

  public extendsError(node: ClassDeclaration | ClassExpression): boolean {
    if (node.getExtends()?.getExpression().getText() === 'Error') {
      return true;
    }
    return node
      .getType()
      .getBaseTypes()
      .some((base) => this.isErrorType(base, new Set()));
  }

  private isErrorType(type: Type, seen: Set<Type>): boolean {
    if (seen.has(type)) {
      return false;
    }
    seen.add(type);
    const symbol = type.getSymbol();
    if (
      symbol?.getName() === 'Error' &&
      symbol
        .getDeclarations()
        .some((declaration) => declaration.getSourceFile().isDeclarationFile())
    ) {
      return true;
    }
    return type.getBaseTypes().some((base) => this.isErrorType(base, seen));
  }
}
