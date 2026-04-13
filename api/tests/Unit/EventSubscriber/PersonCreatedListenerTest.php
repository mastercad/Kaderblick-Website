<?php

namespace Tests\Unit\EventSubscriber;

use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\RelationType;
use App\Entity\User;
use App\Entity\UserRelation;
use App\EventSubscriber\PersonCreatedListener;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use stdClass;

#[AllowMockObjectsWithoutExpectations]
class PersonCreatedListenerTest extends TestCase
{
    private EntityManagerInterface&MockObject $entityManager;
    /** @var EntityRepository<User>&MockObject */
    private EntityRepository $userRepository;
    /** @var EntityRepository<RelationType>&MockObject */
    private EntityRepository $relationTypeRepository;
    /** @var EntityRepository<UserRelation>&MockObject */
    private EntityRepository $userRelationRepository;
    private PersonCreatedListener $listener;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->userRepository = $this->createMock(EntityRepository::class);
        $this->relationTypeRepository = $this->createMock(EntityRepository::class);
        $this->userRelationRepository = $this->createMock(EntityRepository::class);

        $this->entityManager->method('getRepository')
            ->willReturnMap([
                [User::class, $this->userRepository],
                [RelationType::class, $this->relationTypeRepository],
                [UserRelation::class, $this->userRelationRepository]
            ]);

        $this->listener = new PersonCreatedListener();
    }

    public function testPostPersistPlayerWithEmailAndUser(): void
    {
        $player = (new Player())->setEmail('player@test.com');
        $user = new User();
        $relationType = (new RelationType())->setIdentifier('self_player');

        $args = $this->createPostPersistEventArgs();

        $this->userRepository->method('findOneBy')->willReturn($user);
        $this->relationTypeRepository->method('findOneBy')->willReturn($relationType);

        $this->entityManager->expects($this->once())->method('persist');
        $this->entityManager->expects($this->never())->method('flush');

        $this->listener->postPersistPlayer($player, $args);
    }

    public function testPostPersistPlayerWithoutEmail(): void
    {
        $player = new Player(); // no email
        $args = $this->createPostPersistEventArgs();

        $this->entityManager->expects($this->never())->method('persist');
        $this->listener->postPersistPlayer($player, $args);
    }

    public function testPostPersistPlayerWithoutUser(): void
    {
        $player = (new Player())->setEmail('player@test.com');

        $args = $this->createPostPersistEventArgs();

        $this->userRepository->method('findOneBy')->willReturn(null);

        $this->entityManager->expects($this->never())->method('persist');
        $this->listener->postPersistPlayer($player, $args);
    }

    public function testPostUpdatePlayerWithExistingRelation(): void
    {
        $player = (new Player())->setEmail('player@test.com');
        $user = new User();
        $relationType = (new RelationType())->setIdentifier('self_player');
        $existingRelation = (new UserRelation())->setRelationType($relationType);

        $args = $this->createPostUpdateEventArgs();

        $this->userRepository->method('findOneBy')->willReturn($user);
        $this->userRelationRepository->method('findOneBy')->willReturn($existingRelation);

        $this->entityManager->expects($this->never())->method('persist');
        $this->listener->postUpdatePlayer($player, $args);
    }

    public function testPostUpdatePlayerCreatesNewRelation(): void
    {
        $player = (new Player())->setEmail('player@test.com');
        $user = new User();
        $relationType = (new RelationType())->setIdentifier('self_player');

        $args = $this->createPostUpdateEventArgs();

        $this->userRepository->method('findOneBy')->willReturn($user);
        $this->userRelationRepository->method('findOneBy')->willReturn(null);
        $this->relationTypeRepository->method('findOneBy')->willReturn($relationType);

        $this->entityManager->expects($this->once())->method('persist');
        $this->entityManager->expects($this->once())->method('flush');

        $this->listener->postUpdatePlayer($player, $args);
    }

    public function testPostPersistCoachWithEmailAndUser(): void
    {
        $coach = (new Coach())->setEmail('coach@test.com');
        $user = new User();
        $relationType = (new RelationType())->setIdentifier('self_coach');

        $args = $this->createPostPersistEventArgs();

        $this->userRepository->method('findOneBy')->willReturn($user);
        $this->relationTypeRepository->method('findOneBy')->willReturn($relationType);

        $this->entityManager->expects($this->once())->method('persist');
        $this->entityManager->expects($this->once())->method('flush');

        $this->listener->postPersistCoach($coach, $args);
    }

    public function testPostUpdateCoachWithExistingRelation(): void
    {
        $coach = (new Coach())->setEmail('coach@test.com');
        $user = new User();
        $relationType = (new RelationType())->setIdentifier('self_coach');
        $existingRelation = (new UserRelation())->setRelationType($relationType);

        $args = $this->createPostUpdateEventArgs();

        $this->userRepository->method('findOneBy')->willReturn($user);
        $this->userRelationRepository->method('findOneBy')->willReturn($existingRelation);

        $this->entityManager->expects($this->never())->method('persist');
        $this->listener->postUpdateCoach($coach, $args);
    }

    public function testPostUpdateCoachCreatesNewRelation(): void
    {
        $coach = (new Coach())->setEmail('coach@test.com');
        $user = new User();
        $relationType = (new RelationType())->setIdentifier('self_coach');

        $args = $this->createPostUpdateEventArgs();

        $this->userRepository->method('findOneBy')->willReturn($user);
        $this->userRelationRepository->method('findOneBy')->willReturn(null);
        $this->relationTypeRepository->method('findOneBy')->willReturn($relationType);

        $this->entityManager->expects($this->once())->method('persist');
        $this->entityManager->expects($this->once())->method('flush');

        $this->listener->postUpdateCoach($coach, $args);
    }

    private function createPostPersistEventArgs(): PostPersistEventArgs
    {
        return new PostPersistEventArgs(new stdClass(), $this->entityManager);
    }

    private function createPostUpdateEventArgs(): PostUpdateEventArgs
    {
        return new PostUpdateEventArgs(new stdClass(), $this->entityManager);
    }
}
